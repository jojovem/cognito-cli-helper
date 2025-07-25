/**
 * Generates a random password with <length> size
 *
 * At least 1 uppercase
 * At least 1 lowercase
 * At least 1 number
 * At least 1 special character
 *
 * @param length
 */
export const generateRandomPassword = (): string => {
  const length = 12;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*_+?-~=";
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = "";

  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
  .split("")
  .sort(() => 0.5 - Math.random())
  .join("");
};
