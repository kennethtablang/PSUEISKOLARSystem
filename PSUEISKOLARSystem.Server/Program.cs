using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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

                    // Lockout / brute-force protection: 5 failed attempts → 15-minute cooldown.
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

                    // SignalR clients pass the JWT via the access_token query string
                    // (WebSockets can't set Authorization headers). Accept it for hub paths.
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                                context.Token = accessToken;
                            return Task.CompletedTask;
                        }
                    };
                });

            builder.Services.AddAuthorization();

            builder.Services.AddAutoMapper(cfg => { }, typeof(AuthMappingProfile));

            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddScoped<IEmailService, EmailService>();
            builder.Services.AddScoped<INotificationService, NotificationService>();
            builder.Services.AddScoped<IAnnouncementDelivery, AnnouncementDelivery>();
            builder.Services.AddScoped<DatabaseExporter>();
            builder.Services.AddHostedService<DeadlineReminderService>();
            builder.Services.AddHostedService<AnnouncementPublisherService>();
            builder.Services.AddSingleton<IFileStorageService, LocalFileStorageService>();

            builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
            {
                options.MultipartBodyLengthLimit = 10 * 1024 * 1024; // 10 MB
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

            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await dbContext.Database.MigrateAsync();
                await DbSeeder.SeedAsync(scope.ServiceProvider);
            }

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
