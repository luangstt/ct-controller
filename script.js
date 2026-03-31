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

let users = []; // Agora vem da nuvem
let currentUnit = "";
let currentUser = null;
let localDB = [];

// 1. ESCUTA USUÁRIOS NA NUVEM (Sempre que alguém mudar no banco, atualiza aqui)
function iniciarEscutaUsuarios() {
    db.ref('configuracoes/usuarios').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            users = Object.values(data);
        } else {
            // Caso o banco esteja vazio pela primeira vez, cria o Luan e Pedro como Master
            const padrao = [
                { id: "u1", name: "Luan", pass: "Casa1346@@", unit: "001-Casa das Tintas Matriz", level: "admin", multi: true },
                { id: "u2", name: "Pedro", pass: "Casa1346@@", unit: "001-Casa das Tintas Matriz", level: "admin", multi: true }
            ];
            padrao.forEach(u => db.ref('configuracoes/usuarios/' + u.id).set(u));
        }
        if(currentUser && currentUser.level === 'admin') tiAtualizarLista();
    });
}
iniciarEscutaUsuarios();

// 2. LOGIN
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
        } else { alert("Acesso negado para esta filial!"); }
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
    iniciarEscutaBanco();
}

// 3. ESCUTA ESTOQUE NA NUVEM (Tempo Real)
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
    
    if(!novo.nome || !novo.val) return alert("Preencha Nome e Validade!");
    
    db.ref('estoque/' + unitPath + '/' + id).set(novo).then(() => {
        limparFormProd();
        verAba(null, 'aba-estoque');
    });
}

function apagarParcial(id) {
    const item = localDB.find(p => p.id == id);
    const n = prompt(`Produto: ${item.nome}\nQuantos deseja remover?`, "1");
    if(!n) return;
    
    const unitPath = currentUnit.replace(/\s+/g,'_');
    const novaQtd = item.qtd - parseInt(n);
    
    if(novaQtd <= 0) {
        db.ref('estoque/' + unitPath + '/' + id).remove();
    } else {
        db.ref('estoque/' + unitPath + '/' + id).update({ qtd: novaQtd });
    }
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
        
        if(diff < 0) v++; 
        if(diff >= 0 && diff <= 30) c++;
        
        const html = `
            <div class="product-item">
                <div class="p-info">
                    <b>${item.nome}</b><br>
                    <small>${item.marca||''} ${item.linha||''}</small><br>
                    <span class="badge ${sC}">${item.val}</span>
                    <div class="action-btns">
                        <button class="edit-btn" onclick="editar('${item.id}')">✎</button>
                        <button class="del-btn" onclick="apagarParcial('${item.id}')">🗑</button>
                    </div>
                </div>
                <div><b>${item.qtd} un</b></div>
            </div>`;
        
        est.innerHTML += html;
        if(diff <= 30) urg.innerHTML += html;
    });
    
    document.getElementById('s-vencido').innerText = v;
    document.getElementById('s-avencer').innerText = c;
}

// 4. GESTÃO DE USUÁRIOS NA NUVEM
function tiSalvarUsuario() {
    const name = document.getElementById('ti-user-name').value;
    const pass = document.getElementById('ti-user-pass').value;
    const unit = document.getElementById('ti-user-unit').value;
    const level = document.getElementById('ti-user-level').value;
    const multi = document.getElementById('ti-user-multi').checked;
    const editId = document.getElementById('ti-edit-id').value;

    if(!name || !pass) return alert("Preencha nome e senha!");
    
    const id = editId ? editId : "u_" + Date.now();
    const obj = { id, name, pass, unit, level, multi };
    
    db.ref('configuracoes/usuarios/' + id).set(obj).then(() => {
        limparFormTI();
        alert("Usuário atualizado na nuvem!");
    });
}

function tiAtualizarLista() {
    const l = document.getElementById('ti-lista-usuarios');
    l.innerHTML = users.map((u) => `
        <div class="product-item">
            <div class="p-info"><strong>${u.name}</strong><br><small>${u.unit}</small></div>
            <div class="action-btns">
                <button class="edit-btn" style="font-size:1.2rem" onclick="tiEditar('${u.id}')">✎</button>
                <button class="del-btn" style="font-size:1.2rem" onclick="tiExcluir('${u.id}')">🗑</button>
            </div>
        </div>`).join('');
}

function tiEditar(id) {
    const u = users.find(x => x.id === id);
    document.getElementById('ti-user-name').value = u.name;
    document.getElementById('ti-user-pass').value = u.pass;
    document.getElementById('ti-user-unit').value = u.unit;
    document.getElementById('ti-user-level').value = u.level || "comum";
    document.getElementById('ti-user-multi').checked = u.multi || false;
    document.getElementById('ti-edit-id').value = u.id;
}

function tiExcluir(id) {
    if(confirm("Excluir usuário da nuvem?")) {
        db.ref('configuracoes/usuarios/' + id).remove();
    }
}

// UTILITÁRIOS
function alterarVisao(novaFilial) {
    currentUnit = novaFilial;
    document.getElementById('print-unit-name').innerText = currentUnit;
    iniciarEscutaBanco();
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const inicio = document.getElementById('rep-inicio').value;
    const fim = document.getElementById('rep-fim').value;
    let dataToPrint = [...localDB];
    
    if(inicio && fim) {
        dataToPrint = dataToPrint.filter(i => i.val >= inicio && i.val <= fim);
    }
    
    const rows = dataToPrint.map(i => [i.nome, i.marca||'-', i.val, i.qtd]);
    doc.text("Relatorio de Validade - " + currentUnit, 14, 15);
    doc.autoTable({ head: [['Produto', 'Marca', 'Validade', 'Qtd']], body: rows, startY: 20 });
    doc.save(`Relatorio_${currentUnit}.pdf`);
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

function limparFormProd() { 
    document.getElementById('f-nome').value = ""; 
    document.getElementById('f-edit-id').value = ""; 
    document.getElementById('preview-container').style.display='none'; 
}

function limparFormTI() { 
    document.getElementById('ti-user-name').value = ""; 
    document.getElementById('ti-user-pass').value = ""; 
    document.getElementById('ti-edit-id').value = ""; 
}

function verAba(e, id) { 
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    if(e) e.currentTarget.classList.add('active'); 
}