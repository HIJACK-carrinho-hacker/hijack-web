import { networkInterfaces } from "node:os";

const envFile = Bun.file(new URL("../apps/server/.env", import.meta.url));
const envText = (await envFile.exists()) ? await envFile.text() : "";
const port = envText.match(/^\s*SERVER_PORT\s*=\s*(\d+)/m)?.[1] ?? "3000";

const ignorar =
  /docker|^br-|^veth|virbr|vmnet|vboxnet|vethernet|wsl|hyper-v|^tun|^tap|^wg|tailscale|^zt|^utun|^lo$/i;
const wifi = /^wl|wi-?fi|wireless|wlan|sem fio|^en0$/i;

const candidatos = Object.entries(networkInterfaces())
  .flatMap(([nome, enderecos]) =>
    (enderecos ?? [])
      .filter(
        (e) =>
          e.family === "IPv4" &&
          !e.internal &&
          !e.address.startsWith("169.254."),
      )
      .map((e) => ({ nome, ip: e.address })),
  )
  .filter((c) => !ignorar.test(c.nome))
  .sort((a, b) => Number(wifi.test(b.nome)) - Number(wifi.test(a.nome)));

if (candidatos.length === 0) {
  console.log(
    "Nenhum IP de rede encontrado. Conecte o notebook ao hotspot (2,4 GHz) e rode de novo.",
  );
  process.exit(1);
}

const [principal, ...outros] = candidatos;
console.log(
  `IP do notebook: ${principal.ip}  (placa ${principal.nome}${wifi.test(principal.nome) ? ", Wi-Fi" : ""})`,
);
console.log("");
console.log(`  Piloto e hacker:  http://${principal.ip}:${port}`);
console.log(`  Operador:         http://${principal.ip}:${port}/admin`);
console.log(`  Portal do carro:  IP ${principal.ip}, porta ${port}`);

if (outros.length > 0) {
  console.log("");
  console.log("Outras placas (use só se a de cima não for a do hotspot):");
  for (const c of outros) console.log(`  ${c.ip}  (${c.nome})`);
}
