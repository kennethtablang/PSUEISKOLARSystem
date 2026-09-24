// The fixed answer sets on the office's Scholar's Data sheet.
// Keep in sync with the server (Models/Enums/PersonalOptions.cs).

export const SEX_OPTIONS = ['Male', 'Female'];

export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Separated', 'Widowed'];

export const EDUCATION_OPTIONS = [
  'Elementary Level',
  'Elementary Graduate',
  'High School Level',
  'High School Graduate',
  'College Level',
  'College Graduate',
];

export const SUPPORT_SOURCE_OPTIONS = ['Parents', 'Sibling', 'Relative', 'Others', 'Myself'];

// The Yes/No questions on the personal part of the sheet, in the sheet's order.
export const PERSONAL_FLAGS = [
  { key: 'is4PsBeneficiary',         label: '4Ps beneficiary' },
  { key: 'isIndigenousPeople',       label: 'Indigenous Peoples (IP)' },
  { key: 'isPwd',                    label: 'Person with disability (PWD)' },
  { key: 'isSoloParent',             label: 'Solo parent / child of a solo parent' },
  { key: 'isFirstGenerationStudent', label: 'First-generation college student' },
  { key: 'isWorkingStudent',         label: 'Working student' },
];

export const INSTITUTIONAL_DOMAIN = 'psu.edu.ph';

export const EMPTY_PERSONAL = {
  sex: '', civilStatus: '',
  is4PsBeneficiary: false, isIndigenousPeople: false, isPwd: false,
  isSoloParent: false, isFirstGenerationStudent: false, isWorkingStudent: false,
  fatherName: '', fatherLiving: null, fatherEducation: '', fatherOccupation: '', fatherMonthlyIncome: '',
  motherName: '', motherLiving: null, motherEducation: '', motherOccupation: '', motherMonthlyIncome: '',
  familyMembers: '', siblings: '', siblingsStudying: '', mainSupportSource: '',
};

/** Whole years between a yyyy-mm-dd birth date and today; null when not set or invalid. */
export function ageFrom(birthDate) {
  if (!birthDate) return null;
  const b = new Date(String(birthDate).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Converts a form-state personal block into the API shape (blanks → null, numbers parsed). */
export function personalToApi(p) {
  const num = v => (v === '' || v == null ? null : Number(v));
  const str = v => (v == null || String(v).trim() === '' ? null : String(v).trim());
  return {
    sex: str(p.sex),
    civilStatus: str(p.civilStatus),
    is4PsBeneficiary: !!p.is4PsBeneficiary,
    isIndigenousPeople: !!p.isIndigenousPeople,
    isPwd: !!p.isPwd,
    isSoloParent: !!p.isSoloParent,
    isFirstGenerationStudent: !!p.isFirstGenerationStudent,
    isWorkingStudent: !!p.isWorkingStudent,
    fatherName: str(p.fatherName)?.toUpperCase() ?? null,
    fatherLiving: p.fatherLiving,
    fatherEducation: str(p.fatherEducation),
    fatherOccupation: str(p.fatherOccupation),
    fatherMonthlyIncome: num(p.fatherMonthlyIncome),
    motherName: str(p.motherName)?.toUpperCase() ?? null,
    motherLiving: p.motherLiving,
    motherEducation: str(p.motherEducation),
    motherOccupation: str(p.motherOccupation),
    motherMonthlyIncome: num(p.motherMonthlyIncome),
    familyMembers: num(p.familyMembers),
    siblings: num(p.siblings),
    siblingsStudying: num(p.siblingsStudying),
    mainSupportSource: str(p.mainSupportSource),
  };
}

/** The reverse of personalToApi: API data (nulls) into editable form state (''). */
export function personalFromApi(p) {
  const out = { ...EMPTY_PERSONAL };
  if (!p) return out;
  for (const key of Object.keys(EMPTY_PERSONAL)) {
    const v = p[key];
    if (typeof EMPTY_PERSONAL[key] === 'boolean') out[key] = !!v;
    else if (key === 'fatherLiving' || key === 'motherLiving') out[key] = v ?? null;
    else out[key] = v == null ? '' : String(v);
  }
  return out;
}

/** Local PH mobile part (9XXXXXXXXX) from a stored +639… / 09… number. */
export function localMobile(contact) {
  const digits = String(contact || '').replace(/\D/g, '');
  if (digits.startsWith('63')) return digits.slice(2, 12);
  if (digits.startsWith('0')) return digits.slice(1, 11);
  return digits.slice(0, 10);
}
