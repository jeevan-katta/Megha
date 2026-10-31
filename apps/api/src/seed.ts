import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { categories, machines, products } from './core/seed-data';
import { connectDatabase } from './database/mongoose';
import { Category } from './modules/categories/category.model';
import { Machine } from './modules/machines/machine.model';
import { Product } from './modules/products/product.model';
import { User } from './modules/users/user.model';
export async function seed() {
  if (!config.development) throw new Error('Development seeding is disabled in production.');
  await connectDatabase();
  if (!(await Product.countDocuments())) await Product.insertMany(products);
  if (!(await Category.countDocuments())) await Category.insertMany(categories);
  if (!(await Machine.countDocuments())) await Machine.insertMany(machines);
  if (!(await User.exists({ role: 'SUPER_ADMIN' }))) {
    const password = randomBytes(12).toString('base64url');
    await User.create({
      name: 'Megha Administrator',
      email: 'admin@megha.local',
      password: await bcrypt.hash(password, 12),
      role: 'SUPER_ADMIN',
    });
    await fs.mkdir('.local', { recursive: true });
    await fs.writeFile(
      '.local/admin-credentials.txt',
      'Email: admin@megha.local\nPassword: ' + password + '\n',
    );
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await seed();
  await mongoose.disconnect();
  console.log('Development catalogue seeded.');
}
