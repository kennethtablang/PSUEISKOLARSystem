namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public record TwoFactorLoginRequestDto(string Ticket, string Code);
public record DisableTwoFactorDto(string Password);
}
