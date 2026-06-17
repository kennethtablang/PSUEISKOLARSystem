using AutoMapper;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Mappings
{
    public class AuthMappingProfile : Profile
    {
        public AuthMappingProfile()
        {
            CreateMap<ApplicationUser, UserDto>()
                .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.Email ?? string.Empty))
                .ForMember(dest => dest.CampusName, opt => opt.MapFrom(src => src.Campus != null ? src.Campus.Name : null))
                .ForMember(dest => dest.Role, opt => opt.Ignore());
        }
    }
}
