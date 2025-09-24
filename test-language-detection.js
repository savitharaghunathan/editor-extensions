// Simple test script to verify language detection
import fs from "fs";
import path from "path";

// Create test workspace structure
const testDir = "/tmp/test-python-project";

// Clean up and create test directory
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

// Create Python project files
fs.writeFileSync(path.join(testDir, "requirements.txt"), "django>=4.0\nrequests>=2.25\n");
fs.writeFileSync(path.join(testDir, "main.py"), 'print("Hello World")');
fs.writeFileSync(
  path.join(testDir, "setup.py"),
  'from setuptools import setup\nsetup(name="test")',
);
fs.writeFileSync(
  path.join(testDir, "pyproject.toml"),
  '[build-system]\nrequires = ["setuptools", "wheel"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "test-project"\nversion = "0.1.0"',
);

console.log("Created test Python project at:", testDir);
console.log("Files created:");
console.log("- requirements.txt");
console.log("- main.py");
console.log("- setup.py");
console.log("- pyproject.toml");

console.log("\nTest this by:");
console.log("1. Opening VS Code");
console.log("2. Opening the folder:", testDir);
console.log("3. Running F5 to launch extension");
console.log("4. Opening Konveyor profiles and creating a new profile");
