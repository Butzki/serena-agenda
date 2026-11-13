/* Serena Agenda · protótipo navegável
   Dados ficam no localStorage do navegador (só para demonstrar o fluxo; no MVP real o RF09 pede banco remoto). */
(function () {
  'use strict';

  /* ---------- Dados ---------- */
  var KEY = 'serena-agenda-proto-v1';
  var HORA_ABRE = 8 * 60, HORA_FECHA = 20 * 60; // suposição de negócio: 8h–20h
  var mem = null;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function seed() {
    var hoje = new Date();
    return {
      servicos: [
        { id: 's1', nome: 'Corte feminino', duracao: 60, preco: 80 },
        { id: 's2', nome: 'Manicure', duracao: 40, preco: 35 },
        { id: 's3', nome: 'Escova', duracao: 30, preco: 50 }
      ],
      agendamentos: [
        { id: 'a1', cliente: 'Ana Paula', telefone: '(49) 99111-2233', servicoId: 's1', data: iso(hoje), hora: '09:00', status: 'ativo' },
        { id: 'a2', cliente: 'Beatriz Lima', telefone: '(49) 99222-3344', servicoId: 's2', data: iso(hoje), hora: '10:30', status: 'ativo' },
        { id: 'a3', cliente: 'Carla Souza', telefone: '(49) 99333-4455', servicoId: 's3', data: iso(hoje), hora: '14:00', status: 'ativo' },
        { id: 'a4', cliente: 'Daniela Rocha', telefone: '(49) 99444-5566', servicoId: 's1', data: iso(hoje), hora: '15:30', status: 'ativo' },
        { id: 'a5', cliente: 'Elaine Costa', telefone: '(49) 99555-6677', servicoId: 's2', data: iso(addDias(hoje, 1)), hora: '09:30', status: 'ativo' }
      ]
    };
  }
  function carregar() {
    try { var t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch (e) { /* sem storage */ }
    if (!mem) mem = seed();
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignora */ }
    return mem;
  }
  function salvar(db) { mem = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignora */ } }
  function novoId(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 99); }

  /* ---------- Utilidades ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return n;
  }
  function min(h) { var p = h.split(':'); return +p[0] * 60 + +p[1]; }
  function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function brl(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function param(n) { return new URLSearchParams(location.search).get(n); }
  function servico(db, id) { return db.servicos.filter(function (s) { return s.id === id; })[0]; }
  function dataExtensa(s) {
    var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return { dia: d.toLocaleDateString('pt-BR', { weekday: 'long' }), resto: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) };
  }
  function ativos(db, data) {
    return db.agendamentos.filter(function (a) { return a.data === data && a.status !== 'cancelado'; })
      .sort(function (a, b) { return min(a.hora) - min(b.hora); });
  }
  function conflito(db, data, hora, dur, ignorarId) {
    var ini = min(hora), fim = ini + dur;
    return ativos(db, data).filter(function (a) {
      if (a.id === ignorarId) return false;
      var s = servico(db, a.servicoId); var ai = min(a.hora), af = ai + (s ? s.duracao : 30);
      return ini < af && fim > ai; // consecutivos (fim == início) são permitidos
    })[0];
  }
  function sugestoes(db, data, hora, dur) {
    var out = [], t = min(hora);
    for (t = t + 30; t + dur <= HORA_FECHA && out.length < 3; t += 30) {
      if (!conflito(db, data, hhmm(t), dur)) out.push(hhmm(t));
    }
    return out;
  }
  function toast(msg) {
    var r = $('#toast'); if (!r) return;
    r.textContent = msg; r.classList.add('visivel');
  }
  function confirmar(titulo, texto, rotuloOk, perigo) {
    return new Promise(function (resolve) {
      var d = $('#dialogo');
      $('h2', d).textContent = titulo; $('p', d).textContent = texto;
      var ok = $('.ok', d); ok.textContent = rotuloOk;
      ok.className = 'btn ok ' + (perigo ? 'btn-perigo' : 'btn-primario');
      var fechar = function (v) { d.close(); ok.onclick = null; $('.nao', d).onclick = null; resolve(v); };
      ok.onclick = function () { fechar(true); };
      $('.nao', d).onclick = function () { fechar(false); };
      d.onclose = function () { resolve(false); };
      d.showModal();
    });
  }

  /* ---------- Tela 1: Agenda ---------- */
  function paginaAgenda() {
    var db = carregar();
    var data = param('data') || iso(new Date());
    function desenhar() {
      db = carregar();
      var ext = dataExtensa(data);
      $('#dia-semana').textContent = ext.dia.charAt(0).toUpperCase() + ext.dia.slice(1); $('#dia-resto').textContent = ext.resto;
      var lista = $('#lista'); lista.textContent = '';
      var ag = ativos(db, data);
      var todos = db.agendamentos.filter(function (a) { return a.data === data; }).sort(function (a, b) { return min(a.hora) - min(b.hora); });
      var ocupados = ag.length;
      var livresN = 0;
      var cursor = HORA_ABRE;
      var itens = [];
      ag.forEach(function (a) {
        var s = servico(db, a.servicoId); var ini = min(a.hora);
        if (ini - cursor >= 30) { itens.push({ tipo: 'livre', de: cursor, ate: ini }); livresN++; }
        cursor = Math.max(cursor, ini + (s ? s.duracao : 30));
      });
      if (HORA_FECHA - cursor >= 30) { itens.push({ tipo: 'livre', de: cursor, ate: HORA_FECHA }); livresN++; }
      todos.forEach(function (a) { itens.push({ tipo: 'ag', a: a, t: min(a.hora) }); });
      itens.forEach(function (i) { if (i.tipo === 'livre') i.t = i.de; });
      itens.sort(function (x, y) { return x.t - y.t; });

      $('#n-ocupados').textContent = ocupados;
      $('#n-livres').textContent = livresN;
      $('#vazio').hidden = todos.length > 0;

      itens.forEach(function (i) {
        var li = el('li', { class: 'slot' });
        if (i.tipo === 'livre') {
          li.appendChild(el('time', { text: hhmm(i.de) }));
          var a = el('a', { class: 'livre', href: 'novo-agendamento.html?data=' + data + '&hora=' + hhmm(i.de) }, [
            el('span', { text: 'Livre das ' + hhmm(i.de) + ' às ' + hhmm(i.ate) }),
            el('span', { 'aria-hidden': 'true', text: '＋' })
          ]);
          a.setAttribute('aria-label', 'Horário livre das ' + hhmm(i.de) + ' às ' + hhmm(i.ate) + '. Agendar neste horário');
          li.appendChild(a);
        } else {
          var x = i.a, s = servico(db, x.servicoId);
          li.appendChild(el('time', { text: x.hora }));
          var st = x.status === 'ativo' ? ['chip chip-ocupado', '● Ocupado'] : x.status === 'cancelado' ? ['chip chip-cancelado', '✕ Cancelado'] : ['chip chip-noshow', '! Não compareceu'];
          var c = el('article', { class: 'cartao ag ' + (x.status === 'ativo' ? '' : x.status) }, [
            el('div', { class: 'rotulo-sec' }, [el('span', { class: st[0], text: st[1] })]),
            el('p', { class: 'cliente', text: x.cliente }),
            el('p', { class: 'suave', text: (s ? s.nome + ' · ' + s.duracao + ' min' : 'Serviço removido') + ' · ' + x.telefone })
          ]);
          if (x.status === 'ativo') {
            var ac = el('div', { class: 'acoes' });
            var bc = el('button', { class: 'btn btn-secundario btn-pequeno', type: 'button', text: 'Cancelar' });
            bc.setAttribute('aria-label', 'Cancelar agendamento de ' + x.cliente);
            bc.onclick = function () {
              confirmar('Cancelar agendamento?', x.cliente + ' às ' + x.hora + '. O horário ficará livre.', 'Sim, cancelar', true).then(function (ok) {
                if (!ok) return; x.status = 'cancelado'; salvar(db); toast('Agendamento cancelado. Horário liberado.'); desenhar();
              });
            };
            var bn = el('button', { class: 'btn btn-secundario btn-pequeno', type: 'button', text: 'Não compareceu' });
            bn.setAttribute('aria-label', 'Marcar ' + x.cliente + ' como não compareceu');
            bn.onclick = function () { x.status = 'noshow'; salvar(db); toast('Registrado: não compareceu.'); desenhar(); };
            ac.appendChild(bc); ac.appendChild(bn); c.appendChild(ac);
          }
          li.appendChild(c);
        }
        lista.appendChild(li);
      });
      $('#anterior').href = 'agenda.html?data=' + iso(addDias(new Date(data + 'T12:00'), -1));
      $('#proximo').href = 'agenda.html?data=' + iso(addDias(new Date(data + 'T12:00'), 1));
      $('#novo').href = 'novo-agendamento.html?data=' + data;
    }
    if (param('salvo')) toast('Agendamento salvo.');
    desenhar();
  }

  /* ---------- Tela 2: Novo agendamento ---------- */
  function paginaNovoAgendamento() {
    var db = carregar();
    var form = $('#form'), sel = $('#servico');
    db.servicos.forEach(function (s) { sel.appendChild(el('option', { value: s.id, text: s.nome + ' · ' + s.duracao + ' min · ' + brl(s.preco) })); });
    $('#data').value = param('data') || iso(new Date());
    $('#data').min = iso(new Date());
    if (param('hora')) $('#hora').value = param('hora');
    $('#voltar').href = 'agenda.html?data=' + $('#data').value;

    $('#telefone').addEventListener('input', function (e) {
      var d = e.target.value.replace(/\D/g, '').slice(0, 11), o = d;
      if (d.length > 6) o = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length > 10 ? 7 : 6) + '-' + d.slice(d.length > 10 ? 7 : 6);
      else if (d.length > 2) o = '(' + d.slice(0, 2) + ') ' + d.slice(2);
      e.target.value = o;
    });

    function erro(id, msg) {
      var c = $('#c-' + id), e = $('#e-' + id);
      c.classList.toggle('invalido', !!msg); e.textContent = msg || '';
      $('#' + id).setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    }
    var al = $('#alerta-conflito');

    function mostrarConflito(c, dados, dur) {
      var s = servico(db, c.servicoId);
      al.textContent = '';
      al.appendChild(el('strong', { text: 'Horário indisponível' }));
      al.appendChild(el('span', { text: c.cliente + ' já está agendada às ' + c.hora + ' (' + (s ? s.nome : 'serviço') + '). Escolha outro horário.' }));
      var sug = sugestoes(db, dados.data, dados.hora, dur);
      if (sug.length) {
        var box = el('div', { class: 'sugestoes', role: 'group', 'aria-label': 'Horários livres sugeridos' });
        sug.forEach(function (h) {
          var b = el('button', { type: 'button', text: h });
          b.onclick = function () { $('#hora').value = h; al.classList.remove('visivel'); $('#hora').focus(); };
          box.appendChild(b);
        });
        al.appendChild(box);
      }
      al.classList.add('visivel'); al.focus();
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); al.classList.remove('visivel');
      var dados = { cliente: $('#cliente').value.trim(), telefone: $('#telefone').value.trim(), servicoId: sel.value, data: $('#data').value, hora: $('#hora').value };
      var ok = true;
      ok = erro('cliente', dados.cliente.length < 3 ? 'Informe o nome da cliente (mínimo 3 letras).' : '') && ok;
      var dig = dados.telefone.replace(/\D/g, '');
      ok = erro('telefone', dig.length < 10 || dig.length > 11 ? 'Informe um telefone válido com DDD.' : '') && ok;
      ok = erro('servico', !dados.servicoId ? 'Escolha um serviço.' : '') && ok;
      var passado = !dados.data || !dados.hora || new Date(dados.data + 'T' + dados.hora) < new Date();
      ok = erro('data', !dados.data ? 'Escolha a data.' : '') && ok;
      ok = erro('hora', !dados.hora ? 'Escolha a hora.' : (dados.data && passado ? 'Não é possível agendar em horário que já passou.' : '')) && ok;
      if (!ok) { var primeiro = $('.invalido input, .invalido select'); if (primeiro) primeiro.focus(); return; }
      var s = servico(db, dados.servicoId);
      var c = conflito(db, dados.data, dados.hora, s.duracao);
      if (c) { mostrarConflito(c, dados, s.duracao); return; }
      if (min(dados.hora) < HORA_ABRE || min(dados.hora) + s.duracao > HORA_FECHA) {
        erro('hora', 'Fora do horário de funcionamento (08:00 às 20:00).'); $('#hora').focus(); return;
      }
      dados.id = novoId('a'); dados.status = 'ativo';
      db.agendamentos.push(dados); salvar(db);
      location.href = 'agenda.html?data=' + dados.data + '&salvo=1';
    });
  }

  /* ---------- Tela 3: Serviços ---------- */
  function paginaServicos() {
    var db = carregar(), lista = $('#lista');
    $('#vazio').hidden = db.servicos.length > 0;
    db.servicos.forEach(function (s) {
      var li = el('li', {}, [el('article', { class: 'cartao' }, [
        el('p', { class: 'cliente', text: s.nome, style: 'font-weight:700' }),
        el('p', { class: 'suave', text: s.duracao + ' min · ' + brl(s.preco) }),
        el('div', { class: 'acoes', style: 'margin-top:12px' }, [
          el('a', { class: 'btn btn-secundario btn-pequeno', href: 'novo-servico.html?id=' + s.id, 'aria-label': 'Editar ' + s.nome, text: 'Editar' })
        ])
      ])]);
      lista.appendChild(li);
    });
    if (param('salvo')) toast('Serviço salvo.');
    if (param('excluido')) toast('Serviço excluído.');
  }

  /* ---------- Tela 4: Novo / editar serviço ---------- */
  function paginaNovoServico() {
    var db = carregar(), id = param('id');
    var atual = id ? servico(db, id) : null;
    if (atual) {
      $('#titulo').textContent = 'Editar serviço';
      $('#nome').value = atual.nome; $('#duracao').value = atual.duracao;
      $('#preco').value = brl(atual.preco).replace(/ /g, ' ');
      $('#excluir').hidden = false;
    }
    $('#preco').addEventListener('input', function (e) {
      var d = e.target.value.replace(/\D/g, '');
      if (!d) { e.target.value = ''; return; }
      e.target.value = brl(parseInt(d, 10) / 100).replace(/ /g, ' ');
    });
    function erro(idc, msg) {
      $('#c-' + idc).classList.toggle('invalido', !!msg); $('#e-' + idc).textContent = msg || '';
      $('#' + idc).setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg;
    }
    $('#form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nome = $('#nome').value.trim(), dur = $('#duracao').value, preco = $('#preco').value.replace(/\D/g, '');
      var ok = true;
      ok = erro('nome', nome.length < 3 ? 'O nome precisa ter pelo menos 3 letras.' : '') && ok;
      ok = erro('duracao', !/^\d+$/.test(dur) || +dur < 10 || +dur > 480 ? 'Informe a duração em minutos inteiros, de 10 a 480.' : '') && ok;
      ok = erro('preco', !preco || parseInt(preco, 10) <= 0 ? 'Informe um preço maior que R$ 0,00.' : '') && ok;
      if (!ok) { var p = $('.invalido input'); if (p) p.focus(); return; }
      var reg = { nome: nome, duracao: +dur, preco: parseInt(preco, 10) / 100 };
      if (atual) Object.assign(atual, reg); else db.servicos.push(Object.assign({ id: novoId('s') }, reg));
      salvar(db); location.href = 'servicos.html?salvo=1';
    });
    $('#excluir').addEventListener('click', function () {
      var usados = db.agendamentos.filter(function (a) { return a.servicoId === atual.id && a.status === 'ativo'; }).length;
      var txt = usados ? 'Há ' + usados + ' agendamento(s) ativo(s) com este serviço. Eles continuarão na agenda.' : 'Esta ação não pode ser desfeita.';
      confirmar('Excluir "' + atual.nome + '"?', txt, 'Sim, excluir', true).then(function (ok) {
        if (!ok) return; db.servicos = db.servicos.filter(function (s) { return s.id !== atual.id; });
        salvar(db); location.href = 'servicos.html?excluido=1';
      });
    });
  }

  var p = document.body.getAttribute('data-pagina');
  if (p === 'agenda') paginaAgenda();
  else if (p === 'novo-agendamento') paginaNovoAgendamento();
  else if (p === 'servicos') paginaServicos();
  else if (p === 'novo-servico') paginaNovoServico();
})();
