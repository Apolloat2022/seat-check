// Prints one TEACHER_ACCOUNTS entry. Usage: node scripts/add-teacher.mjs <username> <password>
import { hashPassword } from '../middleware.js';

const [name, password] = process.argv.slice(2);
if (!name || !password || /[:,\s]/.test(name)) {
  console.error('Usage: node scripts/add-teacher.mjs <username> <password>\n(username: no spaces, colons or commas)');
  process.exit(1);
}
const salt = crypto.randomUUID();
console.log(`${name.toLowerCase()}:${salt}:${await hashPassword(password, salt)}`);
