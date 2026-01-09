const base = process.env.API_BASE_URL ?? "http://localhost:3000/api";
const email = process.env.ADMIN_EMAIL ?? "davidanchundia619@gmail.com";
const password = process.env.ADMIN_PASSWORD ?? "david";
const shouldPay = (process.env.PAY ?? "0") === "1";

async function main() {
  const loginRes = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginText = await loginRes.text();
  if (!loginRes.ok) {
    throw new Error(`Login falló (${loginRes.status}): ${loginText}`);
  }

  const { token } = JSON.parse(loginText);
  const headers = { Authorization: `Bearer ${token}` };

  const creditsRes = await fetch(`${base}/credits`, { headers });
  const creditsText = await creditsRes.text();
  console.log("GET /credits", creditsRes.status);
  console.log(creditsText);

  const credits = JSON.parse(creditsText);
  if (!Array.isArray(credits) || credits.length === 0) {
    console.log("No hay créditos para probar /credits/:id ni /installments/:id/pay.");
    return;
  }

  const creditId = credits[0].id;
  const creditRes = await fetch(`${base}/credits/${creditId}`, { headers });
  const creditText = await creditRes.text();
  console.log("GET /credits/:id", creditRes.status);
  console.log(creditText);

  const credit = JSON.parse(creditText);
  const installments = credit.installments;
  if (!Array.isArray(installments)) {
    console.log("Detalle sin installments; no se puede probar /pay.");
    return;
  }

  const unpaid = installments.find((i) => i.status !== "PAGADA");
  if (!unpaid) {
    console.log("Todas las cuotas ya están pagadas; no pruebo /pay.");
    return;
  }

  if (!shouldPay) {
    console.log(
      `Hay una cuota no pagada (id=${unpaid.id}, status=${unpaid.status}). Ejecuta con PAY=1 para probar el pago.`
    );
    return;
  }

  const payRes = await fetch(`${base}/installments/${unpaid.id}/pay`, {
    method: "POST",
    headers,
  });

  const payText = await payRes.text();
  console.log("POST /installments/:id/pay", payRes.status);
  console.log(payText);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
