#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the SQL file
const sqlFile = fs.readFileSync(path.join(__dirname, '..', 'timetrack_prd_db_neptune14-00012026.sql'), 'utf-8');

// Department mapping from MySQL int IDs to Supabase UUIDs
const deptMapping = {
  1: 'a48711e5-db05-4962-83e3-e8c9fe1ec878', // Business Consulting
  2: 'a9ac2beb-c3ad-4727-a475-4b8cac27b60d', // Brand Management
  3: '749c95e6-6e20-4352-943d-c1c153228f98', // Martech & Innovation
  4: '1524baa6-ffe1-4eac-ba80-f78f44ce1e3d', // Performance Marketing
  5: '9eb732ed-4138-487b-84a6-44ff18f71ab2', // Brand Management (2)
  6: 'ab692360-0dba-4cc8-8c36-ff8b359f5102', // Content & Outreach
  7: 'd1790cbb-f339-4c16-a82b-5c40f44c41c1', // Creative
  8: '9d055d8c-51fe-49f4-a9a0-9b0058f2dbdd', // Finance
  9: 'a269d901-e5c2-470b-a034-913ff9cf4c28', // People & Culture
  10: 'c05b4b83-feac-4ec2-b5c8-05077874a6cd', // Management
  11: null, // Management Trainee - not in Supabase
};

// Find the employees INSERT section
const employeesInsertStart = sqlFile.indexOf("INSERT INTO `employees`");
const employeesInsertEnd = sqlFile.indexOf("/*!40000 ALTER TABLE `employees` ENABLE KEYS */;");

if (employeesInsertStart === -1 || employeesInsertEnd === -1) {
  console.error('Could not find employees INSERT section');
  process.exit(1);
}

const employeesSection = sqlFile.substring(employeesInsertStart, employeesInsertEnd);

// Parse employee records - each row starts with a tab and (id,
const rowRegex = /\t\((\d+),'([^']*?)','([^']*?)','?([^',]*?)'?,'?([^',]*?)'?,'([^']*?)','([^']*?)','([^']*?)',(\d+),([^,]*?),\'(visible|hidden)\',\'(active|inactive)\',\'([^']*?)\',\'([^']*?)\',([^,]*?),\'(MALE|FEMALE)\'/g;

const employeesByName = new Map(); // Use Map to handle duplicates by full_name
const employeeNumbers = new Set(); // Track used employee numbers
let match;

while ((match = rowRegex.exec(employeesSection)) !== null) {
  const [, id, uuid, nik, dob, workStartDate, fullName, nickname, position, deptId, photo, status, flag, createdAt, updatedAt, supervisor, gender] = match;
  
  // Only include visible and active employees
  if (status === 'visible' && flag === 'active') {
    // Use the first record for each unique full_name (to remove duplicates)
    const nameKey = fullName.toLowerCase().trim();
    if (!employeesByName.has(nameKey) && !employeeNumbers.has(nik)) {
      employeesByName.set(nameKey, {
        id: parseInt(id),
        uuid,
        employee_number: nik,
        date_of_birth: dob === 'NULL' || dob === '' || dob === '0001-01-01' ? null : dob,
        work_start_date: workStartDate === 'NULL' || workStartDate === '' ? null : workStartDate,
        full_name: fullName,
        nickname: nickname || null,
        position,
        department_id: deptMapping[parseInt(deptId)] || null,
        photo: photo === 'NULL' ? null : photo.replace(/^'|'$/g, ''),
        visibility: status === 'visible' ? 'active' : 'archived',
        employment_status: flag,
        gender
      });
      employeeNumbers.add(nik);
    }
  }
}

const employees = Array.from(employeesByName.values());
console.log(`Found ${employees.length} unique active, visible employees (by name and employee_number)`);

// Generate Supabase INSERT SQL
const insertStatements = employees.map(emp => {
  const values = [
    `'${emp.uuid}'`, // id (use MySQL uuid as Supabase id)
    emp.employee_number ? `'${emp.employee_number}'` : 'NULL',
    `'${emp.full_name.replace(/'/g, "''")}'`,
    emp.nickname ? `'${emp.nickname.replace(/'/g, "''")}'` : 'NULL',
    'NULL', // email
    emp.photo ? `'${emp.photo.replace(/'/g, "''")}'` : 'NULL',
    `'${emp.position.replace(/'/g, "''")}'`,
    emp.department_id ? `'${emp.department_id}'` : 'NULL',
    'NULL', // business_unit_id
    'NULL', // direct_supervisor_id
    '40', // weekly_capacity
    emp.work_start_date ? `'${emp.work_start_date}'` : 'NULL',
    emp.date_of_birth ? `'${emp.date_of_birth}'` : 'NULL',
    `'${emp.employment_status}'`,
    `'${emp.visibility}'`,
    `'${emp.gender}'`,
    'NOW()',
    'NOW()'
  ].join(', ');
  
  return `  (${values})`;
});

const sql = `-- Clear existing employees and insert fresh data from SQL file
-- Only active, visible employees are imported (duplicates removed by name and employee_number)

DELETE FROM assignments WHERE employee_id IS NOT NULL;
DELETE FROM employees;

INSERT INTO employees (
  id, employee_number, full_name, nickname, email, photo, position, 
  department_id, business_unit_id, direct_supervisor_id, weekly_capacity,
  work_start_date, date_of_birth, employment_status, visibility, gender,
  created_at, updated_at
) VALUES
${insertStatements.join(',\n')};
`;

// Write to output file
fs.writeFileSync(path.join(__dirname, 'employee_import.sql'), sql);
console.log('Generated employee_import.sql');
