// Gerador de recibos Braves (PDF A4, um recibo por página).
// Uso: node gerar-recibo.js exemplo-recibos.json saida.pdf
// Requer: playwright (chromium). As fontes vêm do Google Fonts.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIR = __dirname;
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, 'logo-braves-branca.png')).toString('base64');
const CSS = fs.readFileSync(path.join(DIR, 'recibo.css'), 'utf8');
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap';

// ---------- valor por extenso (pt-BR) ----------
const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function ate999(n) {
  if (n === 100) return 'cem';
  const p = [], c = Math.floor(n / 100), r = n % 100;
  if (c) p.push(C[c]);
  if (r > 0 && r < 20) p.push(U[r]);
  else if (r >= 20) { const d = Math.floor(r / 10), u = r % 10; p.push(u ? D[d] + ' e ' + U[u] : D[d]); }
  return p.join(' e ');
}
function inteiro(n) {
  if (n === 0) return 'zero';
  const g = [[Math.floor(n / 1e6) % 1000, 'milhão', 'milhões'], [Math.floor(n / 1e3) % 1000, 'mil', 'mil'], [n % 1000, '', '']];
  const parts = [];
  g.forEach(([v, s, pl], i) => { if (v) parts.push({ v, t: i === 1 && v === 1 ? 'mil' : ate999(v) + (s ? ' ' + (v === 1 ? s : pl) : '') }); });
  return parts.map((p, i) => i === 0 ? p.t : (i === parts.length - 1 && (p.v < 100 || p.v % 100 === 0) ? ' e ' : (i === parts.length - 1 ? ' ' : ', ')) + p.t).join('');
}
function extenso(valor) {
  const cents = Math.round(valor * 100), r = Math.floor(cents / 100), c = cents % 100;
  let s = r ? inteiro(r) + (r >= 1e6 && r % 1e6 === 0 ? ' de reais' : r === 1 ? ' real' : ' reais') : '';
  if (c) s = (s ? s + ' e ' : '') + inteiro(c) + (c === 1 ? ' centavo' : ' centavos');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const brl = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------- montagem de um recibo ----------
const assinatura = p => `<div class="sign"><div class="line">${esc(p.nome)}</div><div class="role">${esc(p.papel)}</div><div class="mono small">${esc(p.documento)}</div></div>`;

function recibo(r) {
  const valor = brl(r.valor);
  const texto = `${esc(r.declaracao)} a importância de <b>R$ ${valor}</b> (<i>${extenso(r.valor)}</i>), referente ao pagamento de <b>${esc(r.referente)}</b>, dando por este a mais plena e geral quitação do valor recebido.`;
  const lista = (titulo, itens) => itens?.length ? `<div class="per"><div class="pl">${titulo}</div>${itens.map(i => `<div class="pi">${esc(i)}</div>`).join('')}</div>` : '';
  const comp = r.composicao?.length ? `<table class="comp"><thead><tr><th>Composição do valor</th><th>Valor</th></tr></thead><tbody>${r.composicao.map(([d, v]) => `<tr><td>${esc(d)}</td><td class="mono">${v < 0 ? '− ' : ''}R$ ${brl(Math.abs(v))}</td></tr>`).join('')}<tr class="tot"><td>Total pago</td><td class="mono">R$ ${valor}</td></tr></tbody></table>` : '';
  const detalhes = (r.detalhes || []).map(([k, v]) => `<div class="wide"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const [a1, ...resto] = r.assinaturas;
  const sigs = resto.length === 2
    ? `<div class="sig-main">${assinatura(a1)}</div><div class="sig-row">${resto.map(assinatura).join('')}</div>`
    : `<div class="sig-row">${r.assinaturas.map(assinatura).join('')}</div>`;
  return `<section class="page"><article class="receipt">
  <header class="band"><div class="brand"><img src="${LOGO}" alt="Braves Construções Eficientes"></div>
    <div class="rn"><div class="title">RECIBO</div><div class="num">Nº ${esc(r.numero)}</div></div></header>
  <div class="inner">
    <div class="head"><div class="sub">${esc(r.titulo)}</div><div class="value"><small>VALOR</small>R$ ${valor}</div></div>
    <p class="body">${texto}</p>
    ${lista('Período', r.periodo)}${lista('Serviços incluídos', r.servicos)}${comp}
    <dl class="meta">${detalhes}<div class="wide"><dt>Obra / endereço</dt><dd>${esc(r.obra)}</dd></div></dl>
    <div class="date">${esc(r.cidade)}, ${esc(r.dataQuitacao)}.</div>
    ${r.dataEntrega ? `<div class="entrega"><span>Data de entrega do recibo</span> ${esc(r.dataEntrega)}</div>` : ''}
    <div class="sigs">${sigs}</div>
  </div>
  <footer class="fbar"><span>BRAVES <span class="gold">CONSTRUÇÕES EFICIENTES</span></span><span>Recibo Nº ${esc(r.numero)}</span></footer>
</article></section>`;
}

const EXTRA_CSS = `
.per .pi{width:100%;font-size:10.5pt}
.entrega{font-size:10pt;margin-top:-2mm}
.entrega span{font-size:7.5pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-ink);margin-right:2mm}`;

async function gerarPDF(recibos, saida) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>${CSS}${EXTRA_CSS}</style></head><body>${recibos.map(recibo).join('')}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
  await page.pdf({ path: saida, format: 'A4', printBackground: true });
  await browser.close();
}

module.exports = { recibo, extenso, gerarPDF };

if (require.main === module) {
  const [entrada = path.join(DIR, 'exemplo-recibos.json'), saida = 'recibos.pdf'] = process.argv.slice(2);
  gerarPDF(JSON.parse(fs.readFileSync(entrada, 'utf8')), saida).then(() => console.log('PDF gerado:', saida));
}
