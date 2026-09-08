import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { args, command } from "./ops-backup-lib.mjs";

const options = args(),
  id = Date.now().toString(),
  network = `wemove_scan_drill_${id}`,
  engine = `wemove_clam_drill_${id}`,
  scanner = `wemove_scan_gateway_${id}`;
if (!options.image)
  throw new Error("Pass --image for an already built WEMOVE scanner image");
process.env.SCANNER_TOKEN = randomBytes(32).toString("hex");
const report = {
  startedAt: new Date().toISOString(),
  engineImage: options.engine || "clamav/clamav:stable",
  scannerImage: options.image,
  network,
  engine,
  scanner,
  passed: false,
};
const created = [];
try {
  await command("docker", [
    "network",
    "create",
    "--label",
    "wemove.drill=scanner",
    network,
  ]);
  await command("docker", [
    "run",
    "-d",
    "--name",
    engine,
    "--network",
    network,
    "--label",
    "wemove.drill=scanner",
    report.engineImage,
  ]);
  created.push(engine);
  await command("docker", [
    "run",
    "-d",
    "--name",
    scanner,
    "--network",
    network,
    "--label",
    "wemove.drill=scanner",
    "--read-only",
    "--security-opt",
    "no-new-privileges:true",
    "--cap-drop",
    "ALL",
    "-e",
    "SCANNER_TOKEN",
    "-e",
    `CLAMD_HOST=${engine}`,
    options.image,
  ]);
  created.push(scanner);
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      await command("docker", [
        "exec",
        scanner,
        "node",
        "-e",
        "fetch('http://127.0.0.1:8081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
      ]);
      break;
    } catch {
      if (attempt === 239)
        throw new Error("Real ClamAV engine did not become healthy");
      await delay(1000);
    }
  }
  // EICAR is the standard harmless antivirus test string; never save or execute it.
  const checks = await command("docker", [
    "exec",
    scanner,
    "node",
    "--input-type=module",
    "-e",
    `const scan=async(body,authorized=true)=>{const r=await fetch('http://127.0.0.1:8081/scan',{method:'POST',headers:{'content-type':'application/octet-stream',...(authorized?{authorization:'Bearer '+process.env.SCANNER_TOKEN}:{})},body});return {status:r.status,body:await r.json()}}; const clean=await scan('A harmless WEMOVE document'),eicar=await scan(Buffer.from('WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=','base64')),unauthorized=await scan('test',false);console.log(JSON.stringify({clean,eicar,unauthorized}));`,
  ]);
  Object.assign(report, JSON.parse(checks));
  if (
    report.clean.status !== 200 ||
    report.clean.body.clean !== true ||
    report.eicar.status !== 200 ||
    report.eicar.body.clean !== false ||
    report.unauthorized.status !== 401
  )
    throw new Error("Real engine clean/EICAR/auth checks failed");
  await command("docker", ["stop", "--time", "15", engine]);
  report.unavailable = Number(
    await command("docker", [
      "exec",
      scanner,
      "node",
      "-e",
      "fetch('http://127.0.0.1:8081/scan',{method:'POST',headers:{'content-type':'application/octet-stream',authorization:'Bearer '+process.env.SCANNER_TOKEN},body:'test'}).then(r=>console.log(r.status))",
    ]),
  );
  if (report.unavailable !== 503)
    throw new Error("Scanner outage did not fail closed");
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  for (const container of created)
    await command("docker", ["stop", "--time", "15", container]).catch(
      () => {},
    );
  report.finishedAt = new Date().toISOString();
  report.containersStopped = true;
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/ops-scanner-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
