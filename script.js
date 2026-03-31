const firebaseConfig = {
    apiKey: "AIzaSyCtE1ea-PPQR1MHGrSf1kvwGS1aocnqKrg",
    authDomain: "ct-controller.firebaseapp.com",
    databaseURL: "https://ct-controller-default-rtdb.firebaseio.com",
    projectId: "ct-controller",
    storageBucket: "ct-controller.firebasestorage.app",
    messagingSenderId: "494093984255",
    appId: "1:494093984255:web:784f723c71a6014bb587ca"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let users = JSON.parse(localStorage.getItem('ct_users_v2')) || [
    { name: "Luan", pass: "Casa1346@@", unit: "001-Casa das Tintas Matriz", level: "admin", multi: true },
    { name: "Pedro", pass: "Casa1346@@", unit: "001-Casa das Tintas Matriz", level: "admin", multi: true }
];

let currentUnit = "";
let currentUser = null;
let localDB = [];

function autenticar() {
    const unit = document.getElementById('unit-select').value;
    const user = document.getElementById('user-input').value;
    const pass = document.getElementById('pass-input').value;
    const found = users.find(u => u.name === user && u.pass === pass);
    if (found) {
        if (found.level === "admin" || found.multi || found.unit === unit || unit === "ADMIN-TI") {
            currentUser = found;
            currentUnit = (unit === "ADMIN-TI") ? found.unit : unit;
            entrar();
        } else { alert("Acesso negado!"); }
    } else { alert("Login inválido!"); }
}

function entrar() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    document.getElementById('print-unit-name').innerText = currentUnit;
    if (currentUser.level === "admin") {
        document.getElementById('nav-ti').style.display = 'flex';
        document.getElementById('ti-switcher').style.display = 'block';
    } else if (currentUser.multi) {
        document.getElementById('ti-switcher').style.display = 'block';
    }
    tiAtualizarLista(); 
    iniciarEscutaBanco();
}

function iniciarEscutaBanco() {
    const unitPath = currentUnit.replace(/\s+/g,'_');
    db.ref('estoque/' + unitPath).on('value', (snapshot) => {
        const data = snapshot.val();
        localDB = data ? Object.values(data) : [];
        atualizarDOM();
    });
}

function salvarItem() {
    const idEdit = document.getElementById('f-edit-id').value;
    const id = idEdit ? idEdit : Date.now().toString();
    const unitPath = currentUnit.replace(/\s+/g,'_');
    const novo = { 
        nome: document.getElementById('f-nome').value, 
        val: document.getElementById('f-val').value, 
        qtd: parseInt(document.getElementById('f-qtd').value),
        marca: document.getElementById('f-marca').value,
        linha: document.getElementById('f-linha').value,
        lote: document.getElementById('f-lote').value,
        id: id 
    };
    db.ref('estoque/' + unitPath + '/' + id).set(novo).then(() => { limparFormProd(); verAba(null, 'aba-estoque'); });
}

function apagarParcial(id) {
    const item = localDB.find(p => p.id == id);
    const n = prompt("Qtd a remover:", "1");
    if(!n) return;
    const unitPath = currentUnit.replace(/\s+/g,'_');
    const novaQtd = item.qtd - parseInt(n);
    if(novaQtd <= 0) { db.ref('estoque/' + unitPath + '/' + id).remove(); } 
    else { db.ref('estoque/' + unitPath + '/' + id).update({ qtd: novaQtd }); }
}

function atualizarDOM() {
    const est = document.getElementById('lista-estoque');
    const urg = document.getElementById('lista-urgente');
    const busca = document.getElementById('busca').value.toLowerCase();
    est.innerHTML = ""; urg.innerHTML = "";
    let v = 0, c = 0;
    localDB.forEach(item => {
        if (busca && !item.nome.toLowerCase().includes(busca)) return;
        const d = new Date(item.val + 'T12:00:00');
        const diff = Math.ceil((d - new Date()) / 86400000);
        let sC = diff < 0 ? "vencido" : (diff <= 30 ? "critico" : "em-dia");
        if(diff < 0) v++; if(diff >= 0 && diff <= 30) c++;
        const html = `<div class="product-item"><div class="p-info"><b>${item.nome}</b><br><small>${item.marca||''} ${item.linha||''}</small><br><span class="badge ${sC}">${item.val}</span><div class="action-btns"><button class="edit-btn" onclick="editar('${item.id}')">✎</button><button class="del-btn" onclick="apagarParcial('${item.id}')">🗑</button></div></div><div><b>${item.qtd} un</b></div></div>`;
        est.innerHTML += html;
        if(diff <= 30) urg.innerHTML += html;
    });
    document.getElementById('s-vencido').innerText = v;
    document.getElementById('s-avencer').innerText = c;
}

function previewImage(input) {
    const container = document.getElementById('preview-container');
    const img = document.getElementById('img-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => { img.src = e.target.result; container.style.display = 'block'; };
        reader.readAsDataURL(input.files[0]);
    }
}

function editar(id) {
    const p = localDB.find(x => x.id == id);
    document.getElementById('f-edit-id').value = p.id;
    document.getElementById('f-nome').value = p.nome;
    document.getElementById('f-val').value = p.val;
    document.getElementById('f-qtd').value = p.qtd;
    document.getElementById('f-marca').value = p.marca || "";
    document.getElementById('f-linha').value = p.linha || "";
    document.getElementById('f-lote').value = p.lote || "";
    verAba(null, 'aba-cadastrar');
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const inicio = document.getElementById('rep-inicio').value;
    const fim = document.getElementById('rep-fim').value;
    let dataToPrint = [...localDB];
    if(inicio && fim) { dataToPrint = dataToPrint.filter(i => i.val >= inicio && i.val <= fim); }
    const rows = dataToPrint.map(i => [i.nome, i.marca||'-', i.val, i.qtd]);
    doc.text("Relatorio de Validade - " + currentUnit, 14, 15);
    doc.autoTable({ head: [['Produto', 'Marca', 'Validade', 'Qtd']], body: rows, startY: 20 });
    doc.save(`Relatorio_${currentUnit}.pdf`);
}

function tiSalvarUsuario() {
    const name = document.getElementById('ti-user-name').value;
    const pass = document.getElementById('ti-user-pass').value;
    const unit = document.getElementById('ti-user-unit').value;
    const level = document.getElementById('ti-user-level').value;
    const multi = document.getElementById('ti-user-multi').checked;
    const idx = document.getElementById('ti-edit-index').value;

    if(!name || !pass) return alert("Preencha nome e senha!");
    const obj = { name, pass, unit, level, multi };
    
    if(idx !== "") {
        users[parseInt(idx)] = obj;
    } else {
        users.push(obj);
    }
    
    localStorage.setItem('ct_users_v2', JSON.stringify(users));
    limparFormTI(); 
    tiAtualizarLista();
    alert("Usuário gravado com sucesso!");
}

function tiAtualizarLista() {
    const l = document.getElementById('ti-lista-usuarios');
    l.innerHTML = users.map((u, i) => `
        <div class="product-item">
            <div class="p-info"><strong>${u.name}</strong><br><small>${u.unit}</small></div>
            <div class="action-btns">
                <button class="edit-btn" style="font-size:1.2rem" onclick="tiEditar(${i})">✎</button>
                <button class="del-btn" style="font-size:1.2rem" onclick="tiExcluir(${i})">🗑</button>
            </div>
        </div>`).join('');
}

function tiEditar(index) {
    const u = users[index];
    document.getElementById('ti-user-name').value = u.name;
    document.getElementById('ti-user-pass').value = u.pass;
    document.getElementById('ti-user-unit').value = u.unit;
    document.getElementById('ti-user-level').value = u.level || "comum";
    document.getElementById('ti-user-multi').checked = u.multi || false;
    document.getElementById('ti-edit-index').value = index;
    document.getElementById('aba-ti').scrollTop = 0;
}

function tiExcluir(i) { if(confirm("Excluir usuário?")) { users.splice(i,1); localStorage.setItem('ct_users_v2', JSON.stringify(users)); tiAtualizarLista(); } }

function alterarVisao(novaFilial) {
    currentUnit = novaFilial;
    document.getElementById('print-unit-name').innerText = currentUnit;
    iniciarEscutaBanco();
}

function limparFormTI() { 
    document.getElementById('ti-user-name').value = ""; 
    document.getElementById('ti-user-pass').value = ""; 
    document.getElementById('ti-edit-index').value = ""; 
    document.getElementById('ti-user-multi').checked = false;
}

function limparFormProd() { document.getElementById('f-nome').value = ""; document.getElementById('f-edit-id').value = ""; document.getElementById('preview-container').style.display='none'; }

function verAba(e, id) { 
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(e) e.currentTarget.classList.add('active'); 
}