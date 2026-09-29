using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// The personal and family information from the office's "Scholar's Data" sheet. Scholars
    /// and grantees fill in the same sheet, so it is one owned type stored in the columns of
    /// whichever profile carries it (<see cref="ScholarProfile"/> or <see cref="GranteeProfile"/>),
    /// and the analytics read it the same way for both.
    /// <para>Age is not stored — it is always derived from the birth date on the profile.</para>
    /// </summary>
    [Owned]
    public class PersonalDetails
    {
        [MaxLength(10)]
        public string? Sex { get; set; }

        [MaxLength(20)]
        public string? CivilStatus { get; set; }

        public bool Is4PsBeneficiary { get; set; }
        public bool IsIndigenousPeople { get; set; }
        public bool IsPwd { get; set; }
        public bool IsSoloParent { get; set; }
        public bool IsFirstGenerationStudent { get; set; }
        public bool IsWorkingStudent { get; set; }

        // Entered as separate last / first / middle names; FatherName is kept as the
        // "LAST, FIRST MIDDLE" display form built from them (see PersonalDetailsDto.ApplyTo).
        [MaxLength(100)]
        public string? FatherLastName { get; set; }
        [MaxLength(100)]
        public string? FatherFirstName { get; set; }
        [MaxLength(100)]
        public string? FatherMiddleName { get; set; }
        [MaxLength(150)]
        public string? FatherName { get; set; }
        public bool? FatherLiving { get; set; }
        [MaxLength(30)]
        public string? FatherEducation { get; set; }
        [MaxLength(100)]
        public string? FatherOccupation { get; set; }
        public decimal? FatherMonthlyIncome { get; set; }

        // Entered as separate last / first / middle names; MotherName is kept as the
        // "LAST, FIRST MIDDLE" display form built from them (see PersonalDetailsDto.ApplyTo).
        [MaxLength(100)]
        public string? MotherLastName { get; set; }
        [MaxLength(100)]
        public string? MotherFirstName { get; set; }
        [MaxLength(100)]
        public string? MotherMiddleName { get; set; }
        [MaxLength(150)]
        public string? MotherName { get; set; }
        public bool? MotherLiving { get; set; }
        [MaxLength(30)]
        public string? MotherEducation { get; set; }
        [MaxLength(100)]
        public string? MotherOccupation { get; set; }
        public decimal? MotherMonthlyIncome { get; set; }

        public int? FamilyMembers { get; set; }
        public int? Siblings { get; set; }
        public int? SiblingsStudying { get; set; }

        [MaxLength(20)]
        public string? MainSupportSource { get; set; }
    }
}
