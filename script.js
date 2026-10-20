var API = "https://minhareceita.org";
var GRAFO = "https://grafo.minhareceita.org";
var API_LOGS = "https://www.piway.com.br/unoesc/api";
var MATRICULA = "352180";
var NOME_DA_API = "Minha Receita";
var listaUfs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
var cursor = "";
var parametrosBusca = "";

function pegar(id) {
  return document.getElementById(id);
}

function soNumeros(texto) {
  return String(texto).replace(/\D/g, "");
}

function limpar(texto) {
  if (texto === null || texto === undefined) {
    return "";
  }
  var div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function formatarCnpj(cnpj) {
  var n = ("00000000000000" + soNumeros(cnpj)).slice(-14);
  return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatarData(data) {
  if (!data) {
    return "-";
  }
  var p = String(data).substring(0, 10).split("-");
  return p.length == 3 ? p[2] + "/" + p[1] + "/" + p[0] : data;
}

function formatarDinheiro(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "-";
  }
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarTelefone(tel) {
  var n = soNumeros(tel || "");
  if (n.length < 10) {
    return tel || "";
  }
  return "(" + n.substring(0, 2) + ") " + n.substring(2, n.length - 4) + "-" + n.substring(n.length - 4);
}

function digitoCpf(cpf, tamanho) {
  var soma = 0;
  for (var i = 0; i < tamanho; i++) {
    soma = soma + Number(cpf[i]) * (tamanho + 1 - i);
  }
  var d = (soma * 10) % 11;
  return d == 10 ? 0 : d;
}

function cpfValido(cpf) {
  if (cpf.length != 11 || cpf == cpf[0].repeat(11)) {
    return false;
  }
  return digitoCpf(cpf, 9) == Number(cpf[9]) && digitoCpf(cpf, 10) == Number(cpf[10]);
}

function exibirMensagem(id, mensagem, tipo) {
  pegar(id).innerHTML = mensagem == "" ? "" : '<div class="alert alert-' + tipo + ' mb-0">' + limpar(mensagem) + "</div>";
}

function botaoCarregando(idBotao, carregando) {
  var botao = pegar(idBotao);
  botao.disabled = carregando;
  botao.querySelector(".rotulo").classList.toggle("d-none", carregando);
  botao.querySelector(".carregando").classList.toggle("d-none", !carregando);
}

function classeSituacao(situacao) {
  return situacao == "ATIVA" ? "sit-ativa" : "sit-outra";
}

async function chamarApi(url) {
  var resposta;
  try {
    resposta = await fetch(url);
  } catch (falha) {
    throw new Error("Sem conexão com o servidor de CNPJ no momento. Confira sua internet.");
  }
  var dados = null;
  try {
    dados = await resposta.json();
  } catch (falha) {
    dados = null;
  }
  if (resposta.ok == false) {
    throw new Error(dados && dados.message ? dados.message : "O servidor retornou o código " + resposta.status + ".");
  }
  return dados;
}

function paraUrl(texto) {
  return encodeURIComponent(String(texto || "-").replace(/\//g, "-"));
}

async function chamarApiLogs(caminho) {
  var resposta = await fetch(API_LOGS + caminho, { cache: "no-store" });
  return await resposta.text();
}

async function enviarSemResposta(caminho) {
  try {
    await fetch(API_LOGS + caminho, { mode: "no-cors" });
    return true;
  } catch (falha) {
    return false;
  }
}

async function registrarLog(metodo, resultado) {
  if (MATRICULA == "") {
    return;
  }
  var caminho = "/inserir/log/" + MATRICULA + "/" + paraUrl(NOME_DA_API) + "/" + paraUrl(metodo) + "/" + paraUrl(resultado);
  try {
    await chamarApiLogs(caminho);
  } catch (falha) {
    await enviarSemResposta(caminho);
  }
  if (pegar("modal-logs").classList.contains("show")) {
    carregarLogs();
  }
}

function pegarIdDoLog(log) {
  var nomes = ["idlog", "id_log", "idLog", "IDLOG", "id", "ID", "codigo"];
  for (var i = 0; i < nomes.length; i++) {
    if (log[nomes[i]] !== undefined) {
      return log[nomes[i]];
    }
  }
  return null;
}

async function carregarLogs() {
  var area = pegar("lista-logs");
  exibirMensagem("msg-logs", "", "");
  if (MATRICULA == "") {
    area.innerHTML = "";
    exibirMensagem("msg-logs", "Nenhuma matrícula configurada.", "warning");
    return;
  }
  area.innerHTML = '<p class="text-muted">Buscando seus registros...</p>';
  try {
    var texto = await chamarApiLogs("/logs/" + MATRICULA);
    var logs;
    try {
      logs = JSON.parse(texto);
    } catch (falha) {
      area.innerHTML = "";
      exibirMensagem("msg-logs", texto, "warning");
      return;
    }
    if (!Array.isArray(logs) && logs.msg) {
      area.innerHTML = "";
      exibirMensagem("msg-logs", logs.msg, "warning");
      return;
    }
    if (!Array.isArray(logs) || logs.length == 0) {
      area.innerHTML = '<p class="text-muted">Você ainda não tem registros.</p>';
      pegar("logs-info").textContent = "Sem registros";
      return;
    }
    pegar("logs-info").textContent = logs.length + " log(s) registrado(s)";

    var campos = Object.keys(logs[0]);
    var html = '<div class="table-responsive"><table class="table table-striped tabela-logs"><thead><tr>';
    for (var i = 0; i < campos.length; i++) {
      html += "<th>" + limpar(campos[i]) + "</th>";
    }
    html += "<th>Ação</th></tr></thead><tbody>";
    for (var j = 0; j < logs.length; j++) {
      var id = pegarIdDoLog(logs[j]);
      html += "<tr>";
      for (var k = 0; k < campos.length; k++) {
        html += "<td>" + limpar(logs[j][campos[k]]) + "</td>";
      }
      html += id !== null ? '<td><button type="button" class="btn btn-outline-danger btn-sm" onclick="excluirLog(\'' + id + '\')">Excluir</button></td>' : "<td>-</td>";
      html += "</tr>";
    }
    area.innerHTML = html + "</tbody></table></div>";
  } catch (falha) {
    area.innerHTML = "";
    exibirMensagem("msg-logs", "Falha ao buscar os registros: " + falha.message, "danger");
  }
}

async function excluirLog(idLog) {
  if (confirm("Remover este registro?") == false) {
    return;
  }
  var caminho = "/excluir/log/" + idLog + "/aluno/" + MATRICULA;
  var mensagem = "Registro removido.";
  try {
    var texto = await chamarApiLogs(caminho);
    try {
      mensagem = JSON.parse(texto).msg || mensagem;
    } catch (falha) {
      mensagem = texto;
    }
  } catch (falha) {
    if (await enviarSemResposta(caminho) == false) {
      exibirMensagem("msg-logs", "Falha ao remover o registro.", "danger");
      return;
    }
  }
  await carregarLogs();
  exibirMensagem("msg-logs", mensagem, "success");
}

function montarDado(titulo, valor) {
  return '<div class="col-12 col-sm-6 col-lg-4 dado"><span class="rot">' + titulo + '</span><span class="val">' + limpar(valor || "-") + "</span></div>";
}

function montarLista(itens, vazio) {
  if (itens.length == 0) {
    return '<p class="text-muted mb-0">' + vazio + "</p>";
  }
  return '<ul class="lista-simples">' + itens.join("") + "</ul>";
}

function montarFicha(empresa) {
  var socios = empresa.qsa || [];
  var cnaes = empresa.cnaes_secundarios || [];

  var endereco = (empresa.descricao_tipo_de_logradouro || "") + " " + (empresa.logradouro || "") + ", " + (empresa.numero || "") +
    " - " + (empresa.bairro || "") + ", " + (empresa.municipio || "") + "/" + (empresa.uf || "") + " - CEP " + (empresa.cep || "");
  var atividade = empresa.cnae_fiscal ? empresa.cnae_fiscal + " - " + empresa.cnae_fiscal_descricao : "";

  var itensSocios = [];
  for (var i = 0; i < socios.length; i++) {
    itensSocios.push("<li><strong>" + limpar(socios[i].nome_socio) + '</strong><span class="sub">' + limpar(socios[i].qualificacao_socio) +
      " - entrada em " + formatarData(socios[i].data_entrada_sociedade) + "</span></li>");
  }
  var itensCnaes = [];
  for (var j = 0; j < cnaes.length && j < 15; j++) {
    itensCnaes.push('<li><span class="cnpj-num">' + limpar(cnaes[j].codigo) + "</span> " + limpar(cnaes[j].descricao) + "</li>");
  }
  var avisoCnaes = cnaes.length > 15 ? '<p class="small text-muted mt-2 mb-0">Exibindo 15 de ' + cnaes.length + " atividades.</p>" : "";

  return '<article class="ficha"><div class="ficha-topo">' +
    "<h1>" + limpar(empresa.razao_social) + "</h1>" +
    '<div class="fantasia">' + limpar(empresa.nome_fantasia || "Sem nome fantasia") + "</div>" +
    '<div class="mt-2"><span class="sit ' + classeSituacao(empresa.descricao_situacao_cadastral) + '">' + limpar(empresa.descricao_situacao_cadastral) + "</span> " +
    '<span class="ms-2 cnpj-num">' + formatarCnpj(empresa.cnpj) + "</span></div></div>" +
    '<div class="ficha-corpo"><div class="row">' +
    montarDado("Tipo", empresa.descricao_identificador_matriz_filial) +
    montarDado("Abertura", formatarData(empresa.data_inicio_atividade)) +
    montarDado("Situação desde", formatarData(empresa.data_situacao_cadastral)) +
    montarDado("Natureza jurídica", empresa.natureza_juridica) +
    montarDado("Porte", empresa.porte) +
    montarDado("Capital social", formatarDinheiro(empresa.capital_social)) +
    montarDado("Atividade principal", atividade) +
    montarDado("Telefone", formatarTelefone(empresa.ddd_telefone_1)) +
    montarDado("Simples Nacional", empresa.opcao_pelo_simples ? "Optante" : "Não optante") +
    montarDado("MEI", empresa.opcao_pelo_mei ? "Sim" : "Não") +
    '<div class="col-12 dado"><span class="rot">Endereço</span><span class="val">' + limpar(endereco) + "</span></div></div>" +
    '<div class="row g-4">' +
    '<div class="col-12 col-lg-6"><h3 class="secao-titulo">Quadro societário (' + socios.length + ")</h3>" + montarLista(itensSocios, "Esta empresa não tem sócios cadastrados.") + "</div>" +
    '<div class="col-12 col-lg-6"><h3 class="secao-titulo">Atividades secundárias (' + cnaes.length + ")</h3>" + montarLista(itensCnaes, "Sem atividades secundárias.") + avisoCnaes + "</div></div>" +
    '<div class="mt-4"><button type="button" class="btn btn-outline-dark btn-sm" onclick="verVinculos(\'' + soNumeros(empresa.cnpj) + '\')">Ver vínculos desta empresa</button></div>' +
    "</div></article>";
}

async function consultarCnpj(valor) {
  var cnpj = soNumeros(valor);
  exibirMensagem("msg-cnpj", "", "");
  pegar("resultado-cnpj").innerHTML = "";
  if (cnpj.length != 14) {
    exibirMensagem("msg-cnpj", "Digite um CNPJ com 14 números.", "warning");
    return;
  }
  botaoCarregando("btn-cnpj", true);
  try {
    var empresa = await chamarApi(API + "/" + cnpj);
    pegar("resultado-cnpj").innerHTML = montarFicha(empresa);
    registrarLog("Consultar CNPJ " + cnpj, empresa.razao_social);
  } catch (falha) {
    exibirMensagem("msg-cnpj", falha.message, "danger");
  }
  botaoCarregando("btn-cnpj", false);
}

function montarCartao(empresa) {
  return '<div class="col-12 col-md-6 col-xl-4"><button type="button" class="cartao" data-cnpj="' + soNumeros(empresa.cnpj) + '">' +
    '<div class="nome">' + limpar(empresa.razao_social) + "</div>" +
    '<div class="cnpj-num mb-1">' + formatarCnpj(empresa.cnpj) + "</div>" +
    '<div class="meta">' + limpar(empresa.nome_fantasia || "Sem nome fantasia") + "</div>" +
    '<div class="meta">' + limpar((empresa.municipio || "-") + "/" + (empresa.uf || "-")) + "</div>" +
    '<div class="meta mt-1"><span class="sit ' + classeSituacao(empresa.descricao_situacao_cadastral) + '">' + limpar(empresa.descricao_situacao_cadastral) + "</span></div>" +
    "</button></div>";
}

function montarFiltros() {
  var campos = { uf: "f-uf", cnae: "f-cnae", municipio: "f-municipio", natureza_juridica: "f-natureza" };
  var filtros = "";
  for (var nome in campos) {
    var valor = pegar(campos[nome]).value;
    if (valor != "") {
      filtros += "&" + nome + "=" + valor;
    }
  }
  var cpf = soNumeros(pegar("f-cpf").value);
  if (cpf != "") {
    filtros += "&cnpf=" + encodeURIComponent("***" + cpf.substring(3, 9) + "**");
  }
  return filtros;
}

async function buscarEmpresas(carregarMais) {
  exibirMensagem("msg-busca", "", "");

  if (carregarMais == false) {
    var cpf = soNumeros(pegar("f-cpf").value);
    if (cpf != "" && cpfValido(cpf) == false) {
      exibirMensagem("msg-busca", "Esse CPF não é válido.", "warning");
      return;
    }
    if (cpf != "" && pegar("f-uf").value == "") {
      exibirMensagem("msg-busca", "Para buscar pelo CPF do sócio, selecione também um estado.", "warning");
      return;
    }
    var filtros = montarFiltros();
    if (filtros == "") {
      exibirMensagem("msg-busca", "Preencha pelo menos um campo de busca.", "warning");
      return;
    }
    parametrosBusca = filtros + "&limit=" + pegar("f-limit").value;
    cursor = "";
    pegar("resultado-busca").innerHTML = '<div class="row g-3" id="grade-busca"></div>';
  }

  var url = API + "/?" + parametrosBusca.substring(1);
  if (cursor != "") {
    url += "&cursor=" + encodeURIComponent(cursor);
  }

  botaoCarregando("btn-busca", true);
  pegar("btn-mais").disabled = true;
  try {
    var resposta = await chamarApi(url);
    var lista = resposta.data || [];
    registrarLog("Buscar empresas com filtros", lista.length + " empresas encontradas");

    if (carregarMais == false && lista.length == 0) {
      pegar("resultado-busca").innerHTML = '<p class="text-muted">Não achei empresas com esses dados.</p>';
    } else {
      var html = "";
      for (var i = 0; i < lista.length; i++) {
        html += montarCartao(lista[i]);
      }
      pegar("grade-busca").insertAdjacentHTML("beforeend", html);
      cursor = resposta.cursor || "";
    }
    pegar("mais-wrap").classList.toggle("d-none", cursor == "");
  } catch (falha) {
    exibirMensagem("msg-busca", falha.message, "danger");
  }
  botaoCarregando("btn-busca", false);
  pegar("btn-mais").disabled = false;
}

async function consultarVinculos(valor) {
  var cnpj = soNumeros(valor);
  exibirMensagem("msg-grafo", "", "");
  pegar("resultado-grafo").innerHTML = "";
  if (cnpj.length != 14) {
    exibirMensagem("msg-grafo", "Digite um CNPJ com 14 números.", "warning");
    return;
  }
  botaoCarregando("btn-grafo", true);
  try {
    var lista = await chamarApi(GRAFO + "/" + cnpj);
    registrarLog("Vínculos do CNPJ " + cnpj, (lista ? lista.length : 0) + " vínculos");

    if (!lista || lista.length == 0) {
      pegar("resultado-grafo").innerHTML = '<p class="text-muted">Essa empresa não tem vínculos cadastrados.</p>';
    } else {
      var html = '<h3 class="secao-titulo">' + lista.length + ' vínculo(s) encontrado(s)</h3><div class="row g-3">';
      for (var i = 0; i < lista.length; i++) {
        var v = lista[i];
        html += '<div class="col-12 col-md-6 col-xl-4"><div class="cartao">' +
          '<div class="nome">' + limpar(v.nome || "-") + "</div>" +
          '<div class="meta">' + limpar(v.cpf || "") + "</div>" +
          '<div class="meta mt-1">' + limpar(v.razao_social || "-") + "</div>" +
          '<div class="cnpj-num">' + (v.cnpj ? formatarCnpj(v.cnpj) : "") + "</div></div></div>";
      }
      pegar("resultado-grafo").innerHTML = html + "</div>";
    }
  } catch (falha) {
    exibirMensagem("msg-grafo", falha.message, "danger");
  }
  botaoCarregando("btn-grafo", false);
}

function abrirAba(idAba) {
  new bootstrap.Tab(pegar(idAba)).show();
}

function abrirEmpresa(cnpj) {
  pegar("cnpj").value = formatarCnpj(cnpj);
  abrirAba("tab-cnpj");
  consultarCnpj(cnpj);
  window.scrollTo(0, 0);
}

function verVinculos(cnpj) {
  pegar("cnpj-grafo").value = formatarCnpj(cnpj);
  abrirAba("tab-grafo");
  consultarVinculos(cnpj);
}

document.addEventListener("DOMContentLoaded", function () {
  for (var i = 0; i < listaUfs.length; i++) {
    pegar("f-uf").innerHTML += "<option>" + listaUfs[i] + "</option>";
  }

  pegar("form-cnpj").addEventListener("submit", function (e) {
    e.preventDefault();
    consultarCnpj(pegar("cnpj").value);
  });
  pegar("form-busca").addEventListener("submit", function (e) {
    e.preventDefault();
    buscarEmpresas(false);
  });
  pegar("form-grafo").addEventListener("submit", function (e) {
    e.preventDefault();
    consultarVinculos(pegar("cnpj-grafo").value);
  });
  pegar("btn-mais").addEventListener("click", function () {
    buscarEmpresas(true);
  });
  pegar("btn-limpar").addEventListener("click", function () {
    pegar("form-busca").reset();
    pegar("resultado-busca").innerHTML = "";
    pegar("mais-wrap").classList.add("d-none");
    exibirMensagem("msg-busca", "", "");
  });

  var chips = document.querySelectorAll(".chip");
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener("click", function () {
      abrirEmpresa(this.getAttribute("data-cnpj"));
    });
  }
  pegar("resultado-busca").addEventListener("click", function (e) {
    var cartao = e.target.closest("button.cartao");
    if (cartao) {
      abrirEmpresa(cartao.getAttribute("data-cnpj"));
    }
  });

  pegar("modal-logs").addEventListener("show.bs.modal", carregarLogs);
  pegar("btn-atualizar-logs").addEventListener("click", carregarLogs);
});
