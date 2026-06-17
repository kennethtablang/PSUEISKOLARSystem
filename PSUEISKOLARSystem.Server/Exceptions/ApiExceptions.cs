namespace PSUEISKOLARSystem.Server.Exceptions
{
    public class NotFoundException(string message) : Exception(message);

    public class UnauthorizedException(string message) : Exception(message);

    public class BadRequestException(string message) : Exception(message);
}
