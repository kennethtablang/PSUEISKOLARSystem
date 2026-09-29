using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    /// <summary>
    /// The Scholar's Data sheet as it travels over the API — the same shape for sign-up,
    /// staff edits, and the profile views of both scholars and grantees.
    /// </summary>
    public class PersonalDetailsDto
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

        [MaxLength(100)]
        public string? FatherLastName { get; set; }
        [MaxLength(100)]
        public string? FatherFirstName { get; set; }
        [MaxLength(100)]
        public string? FatherMiddleName { get; set; }
        /// <summary>Read-only "LAST, FIRST MIDDLE" form; built from the three parts on save.</summary>
        [MaxLength(150)]
        public string? FatherName { get; set; }
        public bool? FatherLiving { get; set; }
        [MaxLength(30)]
        public string? FatherEducation { get; set; }
        [MaxLength(100)]
        public string? FatherOccupation { get; set; }
        [Range(0, 10_000_000, ErrorMessage = "Father's monthly income must be a positive amount.")]
        public decimal? FatherMonthlyIncome { get; set; }

        [MaxLength(100)]
        public string? MotherLastName { get; set; }
        [MaxLength(100)]
        public string? MotherFirstName { get; set; }
        [MaxLength(100)]
        public string? MotherMiddleName { get; set; }
        /// <summary>Read-only "LAST, FIRST MIDDLE" form; built from the three parts on save.</summary>
        [MaxLength(150)]
        public string? MotherName { get; set; }
        public bool? MotherLiving { get; set; }
        [MaxLength(30)]
        public string? MotherEducation { get; set; }
        [MaxLength(100)]
        public string? MotherOccupation { get; set; }
        [Range(0, 10_000_000, ErrorMessage = "Mother's monthly income must be a positive amount.")]
        public decimal? MotherMonthlyIncome { get; set; }

        [Range(1, 50, ErrorMessage = "Number of family members must be between 1 and 50.")]
        public int? FamilyMembers { get; set; }
        [Range(0, 40, ErrorMessage = "Number of siblings must be between 0 and 40.")]
        public int? Siblings { get; set; }
        [Range(0, 40, ErrorMessage = "Number of siblings studying must be between 0 and 40.")]
        public int? SiblingsStudying { get; set; }

        [MaxLength(20)]
        public string? MainSupportSource { get; set; }

        /// <summary>Checks the fixed answer sets. Returns null when everything is valid.</summary>
        public string? Validate()
        {
            if (Sex is not null && !PersonalOptions.Sex.Contains(Sex)) return "Select a valid sex.";
            if (CivilStatus is not null && !PersonalOptions.CivilStatus.Contains(CivilStatus)) return "Select a valid civil status.";
            if (FatherEducation is not null && !PersonalOptions.Education.Contains(FatherEducation)) return "Select a valid educational attainment for your father.";
            if (MotherEducation is not null && !PersonalOptions.Education.Contains(MotherEducation)) return "Select a valid educational attainment for your mother.";
            if (MainSupportSource is not null && !PersonalOptions.SupportSource.Contains(MainSupportSource)) return "Select a valid main source of educational support.";
            if (Siblings is int s && SiblingsStudying is int st && st > s) return "Siblings currently studying cannot be more than the number of siblings.";
            return null;
        }

        public void ApplyTo(PersonalDetails p)
        {
            p.Sex = Blank(Sex);
            p.CivilStatus = Blank(CivilStatus);
            p.Is4PsBeneficiary = Is4PsBeneficiary;
            p.IsIndigenousPeople = IsIndigenousPeople;
            p.IsPwd = IsPwd;
            p.IsSoloParent = IsSoloParent;
            p.IsFirstGenerationStudent = IsFirstGenerationStudent;
            p.IsWorkingStudent = IsWorkingStudent;
            p.FatherLastName = Upper(FatherLastName);
            p.FatherFirstName = Upper(FatherFirstName);
            p.FatherMiddleName = Upper(FatherMiddleName);
            p.FatherName = FullName(p.FatherLastName, p.FatherFirstName, p.FatherMiddleName);
            p.FatherLiving = FatherLiving;
            p.FatherEducation = Blank(FatherEducation);
            p.FatherOccupation = Upper(FatherOccupation);
            p.FatherMonthlyIncome = FatherMonthlyIncome;
            p.MotherLastName = Upper(MotherLastName);
            p.MotherFirstName = Upper(MotherFirstName);
            p.MotherMiddleName = Upper(MotherMiddleName);
            p.MotherName = FullName(p.MotherLastName, p.MotherFirstName, p.MotherMiddleName);
            p.MotherLiving = MotherLiving;
            p.MotherEducation = Blank(MotherEducation);
            p.MotherOccupation = Upper(MotherOccupation);
            p.MotherMonthlyIncome = MotherMonthlyIncome;
            p.FamilyMembers = FamilyMembers;
            p.Siblings = Siblings;
            p.SiblingsStudying = SiblingsStudying;
            p.MainSupportSource = Blank(MainSupportSource);
        }

        public static PersonalDetailsDto From(PersonalDetails? p) => p is null ? new() : new()
        {
            Sex = p.Sex,
            CivilStatus = p.CivilStatus,
            Is4PsBeneficiary = p.Is4PsBeneficiary,
            IsIndigenousPeople = p.IsIndigenousPeople,
            IsPwd = p.IsPwd,
            IsSoloParent = p.IsSoloParent,
            IsFirstGenerationStudent = p.IsFirstGenerationStudent,
            IsWorkingStudent = p.IsWorkingStudent,
            FatherLastName = p.FatherLastName,
            FatherFirstName = p.FatherFirstName,
            FatherMiddleName = p.FatherMiddleName,
            FatherName = p.FatherName,
            FatherLiving = p.FatherLiving,
            FatherEducation = p.FatherEducation,
            FatherOccupation = p.FatherOccupation,
            FatherMonthlyIncome = p.FatherMonthlyIncome,
            MotherLastName = p.MotherLastName,
            MotherFirstName = p.MotherFirstName,
            MotherMiddleName = p.MotherMiddleName,
            MotherName = p.MotherName,
            MotherLiving = p.MotherLiving,
            MotherEducation = p.MotherEducation,
            MotherOccupation = p.MotherOccupation,
            MotherMonthlyIncome = p.MotherMonthlyIncome,
            FamilyMembers = p.FamilyMembers,
            Siblings = p.Siblings,
            SiblingsStudying = p.SiblingsStudying,
            MainSupportSource = p.MainSupportSource,
        };

        private static string? Blank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        private static string? Upper(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim().ToUpperInvariant();

        /// <summary>"LAST, FIRST MIDDLE" — the way the office writes a parent's name on the sheet.</summary>
        private static string? FullName(string? last, string? first, string? middle)
        {
            var given = string.Join(" ", new[] { first, middle }.Where(x => x is not null));
            if (last is null) return given.Length == 0 ? null : given;
            return given.Length == 0 ? last : $"{last}, {given}";
        }
    }
}
