using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Infrastructure;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Mappings;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Services;
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            // Every api/… route also answers on api/v1/… — see ApiVersioning for the strategy.
            builder.Services.AddControllers(options =>
                options.Conventions.Add(new ApiVersioning.RouteConvention()));
            builder.Services.AddSignalR();
            builder.Services.AddOpenApi();

            // QuestPDF's Community licence covers non-commercial and small-business use,
            // which includes this university system (PDF report export).
            QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

            builder.Services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services
                .AddIdentity<ApplicationUser, IdentityRole>(options =>
                {
                    options.Password.RequiredLength = 8;
                    options.Password.RequireDigit = true;
                    options.Password.RequireLowercase = true;
                    options.Password.RequireUppercase = true;
                    options.Password.RequireNonAlphanumeric = true;
                    options.User.RequireUniqueEmail = true;

                    // Starting values only — the live threshold and cooldown come from
                    // System Settings and are applied per sign-in in AuthService.
                    options.Lockout.MaxFailedAccessAttempts = 5;
                    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                    options.Lockout.AllowedForNewUsers = true;
                })
                .AddEntityFrameworkStores<ApplicationDbContext>()
                .AddDefaultTokenProviders();

            builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
            builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
            var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>()
                ?? throw new InvalidOperationException("JwtSettings configuration is missing.");

            builder.Services
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtSettings.Issuer,
                        ValidAudience = jwtSettings.Audience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key))
                    };

                    options.Events = new JwtBearerEvents
                    {
                        // SignalR clients pass the JWT via the access_token query string
                        // (WebSockets can't set Authorization headers). Accept it for hub paths.
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                                context.Token = accessToken;
                            return Task.CompletedTask;
                        },

                        // A valid signature only proves the token was ours when it was issued.
                        // SessionValidator confirms the account still backs it — see that file
                        // for why this is not merely a login-time concern.
                        OnTokenValidated = context =>
                            context.HttpContext.RequestServices
                                .GetRequiredService<SessionValidator>()
                                .ValidateAsync(context)
                    };
                });

            builder.Services.AddAuthorization();

            builder.Services.AddAutoMapper(cfg => { }, typeof(AuthMappingProfile));

            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddScoped<IEmailService, EmailService>();
            builder.Services.AddScoped<INotificationService, NotificationService>();
            builder.Services.AddScoped<IAnnouncementDelivery, AnnouncementDelivery>();
            builder.Services.AddScoped<DatabaseExporter>();
            builder.Services.AddScoped<AnalyticsQueries>();
            builder.Services.AddScoped<SummaryReport>();
            builder.Services.AddScoped<DashboardQueries>();

            // Singleton: it holds no state and takes its own scope per send, which is the
            // whole point of it. See BackgroundEmailer.
            builder.Services.AddSingleton<BackgroundEmailer>();
            builder.Services.AddHostedService<DeadlineReminderService>();
            builder.Services.AddHostedService<AnnouncementPublisherService>();
            builder.Services.AddHostedService<GrantReleaseService>();
            builder.Services.AddHostedService<NotificationRetentionService>();
            builder.Services.AddSingleton<IFileStorageService, LocalFileStorageService>();

            // Singleton so the account snapshots it caches are shared by every request.
            builder.Services.AddMemoryCache();
            builder.Services.AddSingleton<SessionValidator>();

            /* The real upload cap is SystemSettings.MaxUploadMb, which an administrator can
               change at runtime; this is only the transport ceiling and is fixed at startup.
               It is set to the largest value SystemSettingsController will accept (100 MB) so
               that the configured setting is always the binding constraint — otherwise raising
               MaxUploadMb past this number would fail with a bare 413 instead of the
               controller's explanatory message. */
            builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
            {
                options.MultipartBodyLengthLimit = 100L * 1024 * 1024;
            });

            builder.Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc(ApiVersioning.CurrentVersion, new OpenApiInfo
                {
                    Title = "PSU e-Iskolar API",
                    Version = ApiVersioning.CurrentVersion,
                    Description =
                        "Versioned by URL segment. `/api/v1/...` is canonical; the unversioned " +
                        "`/api/...` paths are legacy aliases that resolve to the same actions and " +
                        "are omitted here so the documented surface stays unambiguous.",
                });

                // Document each action once, at its versioned address.
                options.DocInclusionPredicate((_, api) =>
                    api.RelativePath?.StartsWith(ApiVersioning.Prefix, StringComparison.OrdinalIgnoreCase) == true);

                var jwtScheme = new OpenApiSecurityScheme
                {
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.Http
                };
                options.AddSecurityDefinition("Bearer", jwtScheme);
                options.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
                {
                    { new OpenApiSecuritySchemeReference("Bearer", doc), [] }
                });
            });

            // Rate limiting for sensitive auth endpoints (anti brute-force / abuse).
            // Partitioned by client IP: max 10 requests per minute per IP on the "auth" policy.
            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.AddPolicy("auth", httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 10,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        }));

                // Slightly more lenient bucket for the live email-availability check
                // (a debounced form field), while still capping bulk enumeration.
                options.AddPolicy("emailcheck", httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 20,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        }));
            });

            var app = builder.Build();

            // The SMTP login lives in user-secrets (never in git), so a fresh clone has none and
            // every email fails quietly in the background. Say so once, loudly, at startup.
            var smtp = app.Services.GetRequiredService<IOptions<EmailSettings>>().Value;
            if (string.IsNullOrWhiteSpace(smtp.Username) || string.IsNullOrWhiteSpace(smtp.Password))
                app.Logger.LogWarning(
                    "EmailSettings:Username/Password are not set — no emails (verification, password reset, " +
                    "notifications) will be sent. Set them with: dotnet user-secrets set \"EmailSettings:Username\" \"<gmail>\" " +
                    "and dotnet user-secrets set \"EmailSettings:Password\" \"<app password>\" (see README.md).");

            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await dbContext.Database.MigrateAsync();
                await DbSeeder.SeedAsync(scope.ServiceProvider);

                // Sample scholars, grantees, documents and releases for trying the pages out.
                // Development only — the sample accounts share a published password.
                if (app.Environment.IsDevelopment())
                    await Revision4SampleSeeder.SeedAsync(scope.ServiceProvider);

                // Cross-matching lines left open although the student already has an account —
                // listed before the account existed, or before lines were applied on the spot —
                // are applied now: grants recorded, past grantees upgraded to scholar accounts.
                var reconciled = await MasterList.ReconcileAsync(dbContext, scope.ServiceProvider.GetService<INotificationService>());
                if (reconciled > 0)
                    app.Logger.LogInformation("Applied {Count} open cross-matching line(s) to existing accounts.", reconciled);
            }

            // First in the pipeline so the headers reach static assets and error responses too.
            // The CSP is held back in development, where Swagger UI's inline bootstrap script
            // would trip script-src 'self'.
            app.UseSecurityHeaders(sendCsp: !app.Environment.IsDevelopment());

            /* Last line of defence for anything a controller did not handle. Without it an
               unexpected exception produced an empty 500 in production, so the client could only
               show its generic fallback and the user had no idea whether to retry. The
               middleware logs the full exception for developers; the response carries only a
               plain message, never a stack trace or SQL. */
            app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
            {
                var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;

                // A database constraint (duplicate key, a row still referenced elsewhere) is a
                // conflict with existing data, not a server fault — say so.
                var isConflict = error is DbUpdateException;
                context.Response.StatusCode = isConflict ? StatusCodes.Status409Conflict : StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsJsonAsync(new
                {
                    message = isConflict
                        ? "The change conflicts with existing records and was not saved. Refresh the page and try again."
                        : "An unexpected error occurred. Please try again, and contact the administrator if it keeps happening.",
                });
            }));

            app.UseDefaultFiles();
            app.MapStaticAssets();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
                app.UseSwagger();
                app.UseSwaggerUI(options =>
                {
                    options.SwaggerEndpoint("/swagger/v1/swagger.json", "PSU e-Iskolar API v1");
                });
            }
            else
            {
                // Enforce HTTPS at the browser via HSTS in production (NFR security).
                app.UseHsts();
            }

            app.UseHttpsRedirection();

            app.UseRateLimiter();

            app.UseAuthentication();
            app.UseAuthorization();

            app.MapControllers();
            app.MapHub<PSUEISKOLARSystem.Server.Hubs.NotificationHub>("/hubs/notifications");

            app.MapFallbackToFile("/index.html");

            app.Run();
        }
    }
}
