// ===== API Minha Receita =====
// Método 1: GET {API}/{cnpj}            -> consulta de um CNPJ (sem filtros)
// Método 2: GET {API}/?uf=..&cnae=..    -> busca paginada (com filtros)
// Método 3: GET {GRAFO}/{cnpj}          -> vínculos entre empresas e sócios
// Método 4: GET {API}/updated           -> data de atualização da base
const API = "https://minhareceita.org";
const GRAFO = "https://grafo.minhareceita.org";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

let cursorAtual = null;
let paramsAtuais = null;

// ---------- utilidades ----------
const $ = (id) => document.getElementById(id);

function esc(valor) {
  const d = document.createElement("div");
  d.textContent = valor ?? "";
  return d.innerHTML;
}

function limparCnpj(texto) {
  return String(texto).toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function formatarCnpj(c) {
  const s = limparCnpj(c).padStart(14, "0");
  return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`;
}

// Valida dígitos verificadores (funciona também para o CNPJ alfanumérico)
function cnpjValido(c) {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(.)\1+$/.test(c)) return false;
  const valores = [...c].map((ch) => ch.charCodeAt(0) - 48);
  const dv = (qtd) => {
    let peso = qtd - 7, soma = 0;
    for (let i = 0; i < qtd; i++) {
      soma += valores[i] * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === valores[12] && dv(13) === valores[13];
}

function formatarData(iso) {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function formatarDinheiro(v) {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function telefone(t) {
  if (!t) return "—";
  const s = String(t).replace(/\D/g, "");
  if (s.length < 10) return t;
  return `(${s.slice(0,2)}) ${s.slice(2, s.length - 4)}-${s.slice(-4)}`;
}

function endereco(e) {
  const partes = [
    [e.descricao_tipo_de_logradouro, e.logradouro].filter(Boolean).join(" "),
    e.numero, e.complemento, e.bairro,
    [e.municipio, e.uf].filter(Boolean).join("/"),
    e.cep ? "CEP " + String(e.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2") : ""
  ].filter(Boolean);
  return partes.join(", ") || "—";
}

function classeSituacao(desc) {
  const d = (desc || "").toUpperCase();
  if (d === "ATIVA") return "sit-ativa";
  if (!d) return "sit-neutra";
  return "sit-outra";
}

function ocupado(botaoId, sim) {
  const b = $(botaoId);
  b.disabled = sim;
  b.querySelector(".rotulo").classList.toggle("d-none", sim);
  b.querySelector(".carregando").classList.toggle("d-none", !sim);
}

function alerta(id, msg, tipo = "danger") {
  $(id).innerHTML = msg ? `<div class="alert alert-${tipo} mb-0" role="alert">${esc(msg)}</div>` : "";
}

async function pedir(url) {
  let resp;
  try {
    resp = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new Error("Não foi possível falar com a API. Verifique sua conexão e tente de novo em instantes.");
  }
  let corpo = null;
  try { corpo = await resp.json(); } catch (e) { /* resposta sem JSON */ }
  if (!resp.ok) {
    const msg = corpo && corpo.message ? corpo.message : `A API respondeu com erro ${resp.status}.`;
    throw new Error(msg);
  }
  return corpo;
}

function mostrarAba(id) {
  bootstrap.Tab.getOrCreateInstance($(id)).show();
}

// ---------- Método 4: /updated ----------
async function carregarAtualizacao() {
  try {
    const dados = await pedir(`${API}/updated`);
    const texto = JSON.stringify(dados);
    const m = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
    $("atualizado-txt").textContent = m
      ? `Base da Receita de ${m[3]}/${m[2]}/${m[1]}`
      : "Base da Receita Federal";
  } catch (e) {
    $("atualizado-txt").textContent = "Base da Receita Federal";
  }
}

// ---------- Método 1: consulta por CNPJ (sem filtros, resultado único) ----------
function dado(rotulo, valor) {
  return `<div class="col-12 col-sm-6 col-lg-4 dado"><span class="rot">${esc(rotulo)}</span><span class="val">${esc(valor || "—")}</span></div>`;
}

function renderFicha(e) {
  const socios = e.qsa || [];
  const cnaes = e.cnaes_secundarios || [];
  const fone = [e.ddd_telefone_1, e.ddd_telefone_2].filter(Boolean).map(telefone).join(" · ");

  const htmlSocios = socios.length
    ? `<ul class="lista-simples">${socios.map((s) => `
        <li><strong>${esc(s.nome_socio)}</strong>
          <span class="sub">${esc(s.qualificacao_socio || "")}${s.data_entrada_sociedade ? " · desde " + formatarData(s.data_entrada_sociedade) : ""}</span>
        </li>`).join("")}</ul>`
    : `<p class="text-muted mb-0">Nenhum sócio informado.</p>`;

  const htmlCnaes = cnaes.length
    ? `<ul class="lista-simples">${cnaes.slice(0, 15).map((c) => `
        <li><span class="cnpj-num">${esc(c.codigo)}</span> <span>${esc(c.descricao)}</span></li>`).join("")}</ul>
       ${cnaes.length > 15 ? `<p class="small text-muted mt-2 mb-0">+ ${cnaes.length - 15} atividades não exibidas.</p>` : ""}`
    : `<p class="text-muted mb-0">Sem atividades secundárias.</p>`;

  return `
  <article class="ficha">
    <div class="ficha-topo">
      <h2>${esc(e.razao_social)}</h2>
      <div class="fantasia">${esc(e.nome_fantasia || "Sem nome fantasia")}</div>
      <div class="mt-2">
        <span class="sit ${classeSituacao(e.descricao_situacao_cadastral)}">${esc(e.descricao_situacao_cadastral || "Situação não informada")}</span>
        <span class="ms-2 cnpj-num">${formatarCnpj(e.cnpj)}</span>
      </div>
    </div>
    <div class="ficha-corpo">
      <div class="row">
        ${dado("Tipo", e.descricao_identificador_matriz_filial)}
        ${dado("Abertura", formatarData(e.data_inicio_atividade))}
        ${dado("Situação desde", formatarData(e.data_situacao_cadastral))}
        ${dado("Natureza jurídica", e.natureza_juridica)}
        ${dado("Porte", e.porte)}
        ${dado("Capital social", formatarDinheiro(e.capital_social))}
        ${dado("Atividade principal", e.cnae_fiscal ? `${e.cnae_fiscal} — ${e.cnae_fiscal_descricao}` : "")}
        ${dado("Telefone", fone)}
        ${dado("Simples Nacional", e.opcao_pelo_simples ? "Optante" : "Não optante")}
        ${dado("MEI", e.opcao_pelo_mei ? "Sim" : "Não")}
        <div class="col-12 dado"><span class="rot">Endereço</span><span class="val">${esc(endereco(e))}</span></div>
      </div>

      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <h3 class="secao-titulo"><i class="bi bi-people me-1"></i>Quadro societário (${socios.length})</h3>
          ${htmlSocios}
        </div>
        <div class="col-12 col-lg-6">
          <h3 class="secao-titulo"><i class="bi bi-list-check me-1"></i>Atividades secundárias (${cnaes.length})</h3>
          ${htmlCnaes}
        </div>
      </div>

      <div class="mt-4">
        <button type="button" class="btn btn-outline-dark btn-sm" onclick="verVinculos('${esc(limparCnpj(e.cnpj))}')">
          <i class="bi bi-diagram-3 me-1"></i> Ver vínculos desta empresa
        </button>
      </div>
    </div>
  </article>`;
}

async function consultarCnpj(valor) {
  const cnpj = limparCnpj(valor);
  alerta("alerta-cnpj", "");
  $("resultado-cnpj").innerHTML = "";

  if (cnpj.length !== 14) return alerta("alerta-cnpj", "O CNPJ precisa ter 14 caracteres.", "warning");
  if (!cnpjValido(cnpj)) return alerta("alerta-cnpj", "CNPJ inválido: os dígitos verificadores não conferem.", "warning");

  ocupado("btn-cnpj", true);
  try {
    const empresa = await pedir(`${API}/${cnpj}`);
    $("resultado-cnpj").innerHTML = renderFicha(empresa);
  } catch (e) {
    alerta("alerta-cnpj", e.message);
  } finally {
    ocupado("btn-cnpj", false);
  }
}

// ---------- Método 2: busca com filtros (lista com repetição) ----------
function renderCartao(e) {
  return `
  <div class="col-12 col-md-6 col-xl-4">
    <button type="button" class="cartao" data-cnpj="${esc(limparCnpj(e.cnpj))}">
      <div class="nome">${esc(e.razao_social)}</div>
      <div class="cnpj-num mb-1">${formatarCnpj(e.cnpj)}</div>
      <div class="meta">${esc(e.nome_fantasia || "Sem nome fantasia")}</div>
      <div class="meta"><i class="bi bi-geo-alt me-1"></i>${esc([e.municipio, e.uf].filter(Boolean).join("/") || "—")}</div>
      <div class="meta mt-1"><span class="sit ${classeSituacao(e.descricao_situacao_cadastral)}">${esc(e.descricao_situacao_cadastral || "—")}</span></div>
    </button>
  </div>`;
}

function lerFiltros() {
  const p = new URLSearchParams();
  const campos = { uf: "f-uf", cnae: "f-cnae", municipio: "f-municipio", natureza_juridica: "f-natureza" };
  for (const [param, id] of Object.entries(campos)) {
    const v = $(id).value.trim();
    if (v) p.set(param, v);
  }
  return p;
}

async function buscarEmpresas(maisPaginas) {
  alerta("alerta-busca", "");
  if (!maisPaginas) {
    const filtros = lerFiltros();
    if ([...filtros.keys()].length === 0) {
      return alerta("alerta-busca", "Escolha pelo menos um filtro para buscar.", "warning");
    }
    filtros.set("limit", $("f-limit").value);
    paramsAtuais = filtros;
    cursorAtual = null;
    $("resultado-busca").innerHTML = `<div class="row g-3" id="grade-busca"></div>`;
  }

  const p = new URLSearchParams(paramsAtuais);
  if (cursorAtual) p.set("cursor", cursorAtual);

  ocupado("btn-busca", true);
  $("btn-mais").disabled = true;
  try {
    const resp = await pedir(`${API}/?${p.toString()}`);
    const lista = resp.data || [];
    const grade = $("grade-busca");

    if (!maisPaginas && lista.length === 0) {
      $("resultado-busca").innerHTML = `<p class="text-muted">Nenhuma empresa encontrada com esses filtros.</p>`;
      $("mais-wrap").classList.add("d-none");
      return;
    }
    grade.insertAdjacentHTML("beforeend", lista.map(renderCartao).join(""));
    cursorAtual = resp.cursor || null;
    $("mais-wrap").classList.toggle("d-none", !cursorAtual);
  } catch (e) {
    alerta("alerta-busca", e.message);
  } finally {
    ocupado("btn-busca", false);
    $("btn-mais").disabled = false;
  }
}

// ---------- Método 3: vínculos (grafo) ----------
async function consultarVinculos(valor) {
  const cnpj = limparCnpj(valor);
  alerta("alerta-grafo", "");
  $("resultado-grafo").innerHTML = "";

  if (!cnpjValido(cnpj)) return alerta("alerta-grafo", "Informe um CNPJ válido (14 caracteres).", "warning");

  ocupado("btn-grafo", true);
  try {
    const lista = await pedir(`${GRAFO}/${cnpj}`);
    if (!Array.isArray(lista) || lista.length === 0) {
      $("resultado-grafo").innerHTML = `<p class="text-muted">Nenhum vínculo encontrado para ${formatarCnpj(cnpj)}.</p>`;
      return;
    }
    $("resultado-grafo").innerHTML = `
      <h3 class="secao-titulo">${lista.length} vínculo(s) encontrado(s)</h3>
      <div class="row g-3">
        ${lista.map((v) => `
          <div class="col-12 col-md-6 col-xl-4">
            <div class="cartao">
              <div class="nome"><i class="bi bi-person me-1"></i>${esc(v.nome || "—")}</div>
              <div class="meta">${esc(v.cpf || "")}</div>
              <div class="meta mt-1"><i class="bi bi-building me-1"></i>${esc(v.razao_social || "—")}</div>
              <div class="cnpj-num">${v.cnpj ? formatarCnpj(v.cnpj) : ""}</div>
            </div>
          </div>`).join("")}
      </div>`;
  } catch (e) {
    alerta("alerta-grafo", e.message);
  } finally {
    ocupado("btn-grafo", false);
  }
}

// ---------- atalhos entre abas ----------
function abrirEmpresa(cnpj) {
  $("cnpj").value = formatarCnpj(cnpj);
  mostrarAba("tab-cnpj");
  consultarCnpj(cnpj);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function verVinculos(cnpj) {
  $("cnpj-grafo").value = formatarCnpj(cnpj);
  mostrarAba("tab-grafo");
  consultarVinculos(cnpj);
}

// ---------- inicialização ----------
function mascara(input) {
  input.addEventListener("input", () => {
    const s = limparCnpj(input.value).slice(0, 14);
    let out = s;
    if (s.length > 12) out = `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`;
    else if (s.length > 8) out = `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8)}`;
    else if (s.length > 5) out = `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5)}`;
    else if (s.length > 2) out = `${s.slice(0,2)}.${s.slice(2)}`;
    input.value = out;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("f-uf").insertAdjacentHTML("beforeend", UFS.map((u) => `<option>${u}</option>`).join(""));
  ["f-cnae", "f-municipio"].forEach((id) =>
    $(id).addEventListener("input", (ev) => (ev.target.value = ev.target.value.replace(/\D/g, ""))));
  mascara($("cnpj"));
  mascara($("cnpj-grafo"));

  $("form-cnpj").addEventListener("submit", (ev) => { ev.preventDefault(); consultarCnpj($("cnpj").value); });
  $("form-busca").addEventListener("submit", (ev) => { ev.preventDefault(); buscarEmpresas(false); });
  $("form-grafo").addEventListener("submit", (ev) => { ev.preventDefault(); consultarVinculos($("cnpj-grafo").value); });
  $("btn-mais").addEventListener("click", () => buscarEmpresas(true));
  $("btn-limpar").addEventListener("click", () => {
    $("form-busca").reset();
    $("resultado-busca").innerHTML = "";
    $("mais-wrap").classList.add("d-none");
    alerta("alerta-busca", "");
  });

  document.querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => abrirEmpresa(b.dataset.cnpj)));
  $("resultado-busca").addEventListener("click", (ev) => {
    const c = ev.target.closest("button.cartao");
    if (c) abrirEmpresa(c.dataset.cnpj);
  });

  carregarAtualizacao();
});
