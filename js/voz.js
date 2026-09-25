// voz.js - Motor de Voz (Watchdog, Dicionário e Grafismo Premium)

const dicionarioNumeros = {
    "zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "três": 3, "tres": 3, 
    "quatro": 4, "cinco": 5, "seis": 6, "meia": 6, "sete": 7, 
    "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, 
    "treze": 13, "catorze": 14, "quinze": 15, "dezasseis": 16, 
    "dezassete": 17, "dezoito": 18, "dezanove": 19, "vinte": 20,
    "trinta": 30, "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90
};

const chavesOrdenadas = Object.keys(dicionarioNumeros).sort((a, b) => b.length - a.length);

function extrairNumeros(frase) {
    let fraseLimpa = frase.toLowerCase();
    chavesOrdenadas.forEach(chave => {
        if (chave.includes(" ")) {
            fraseLimpa = fraseLimpa.replace(new RegExp(`\\b${chave}\\b`, "g"), dicionarioNumeros[chave]);
        }
    });

    const palavras = fraseLimpa.split(/\s+/);
    const numerosEncontrados = [];
    
    for (let i = 0; i < palavras.length; i++) {
        const palavra = palavras[i].replace(/[^a-z0-9]/g, ''); 
        if (!isNaN(parseInt(palavra))) { 
            numerosEncontrados.push(parseInt(palavra)); 
        } else if (dicionarioNumeros[palavra] !== undefined) { 
            numerosEncontrados.push(dicionarioNumeros[palavra]); 
        }
    }
    return numerosEncontrados;
}

function getPlayerIdByNumber(numero) {
    if (!state.roster) return null;
    const jogador = state.roster.find(p => parseInt(p.number) === numero && p.active !== false);
    return jogador ? jogador.id : null;
}

function interpretarComando(transcricao) {
    const texto = transcricao.toLowerCase();
    const numeros = extrairNumeros(texto);
    const tem = (palavras) => palavras.some(palavra => texto.includes(palavra));

    if (tem(["substituição", "sai", "entra", "troca", "tira", "mete"])) {
        if (numeros.length < 2) return { acao: "SUBSTITUICAO_ERRO" };
        let idxEntra = Math.min(texto.indexOf("entra") !== -1 ? texto.indexOf("entra") : 9999, texto.indexOf("mete") !== -1 ? texto.indexOf("mete") : 9999);
        let idxSai = Math.min(texto.indexOf("sai") !== -1 ? texto.indexOf("sai") : 9999, texto.indexOf("tira") !== -1 ? texto.indexOf("tira") : 9999);
        if (idxEntra < idxSai) return { acao: "SUBSTITUICAO", entra: numeros[0], sai: numeros[1] }; 
        else return { acao: "SUBSTITUICAO", sai: numeros[0], entra: numeros[1] }; 
    }

    if (tem(["amarelo", "amarelado"])) return { acao: tem(["adversário", "deles", "banco"]) ? "CARTAO_AMARELO_OPP" : "CARTAO_AMARELO", jogador: numeros[0] || "opp" };
    if (tem(["vermelho", "expulso", "rua"])) return { acao: tem(["adversário", "deles", "banco"]) ? "CARTAO_VERMELHO_OPP" : "CARTAO_VERMELHO", jogador: numeros[0] || "opp" };
    if (tem(["autogolo", "própria", "traição"])) return { acao: tem(["adversário", "deles", "favor"]) ? "GOLO_FAVOR_AUTOGOLO" : "AUTOGOLO_NOSSO", jogador: numeros[0] || null };
    if (tem(["penálti", "penalty", "castigo máximo"])) return { acao: tem(["sofrido", "contra", "adversário", "deles"]) ? "GOLO_CONTRA_PENALTI" : "GOLO_PENALTI", jogador: numeros[0], guardaRedes: numeros[0] || null };
    if (tem(["sofreu", "sofrido", "sofremos", "adversário marcou", "golo deles", "golo contra"])) return { acao: "GOLO_CONTRA", guardaRedes: numeros.length > 0 ? numeros[0] : null };
    
    if (tem(["golo", "marcou", "golaço", "faturou", "encostou", "livre", "falta direta"])) {
        let isLivre = tem(["livre", "falta direta"]);
        let assist = (tem(["assistência", "passe", "cruzamento", "assistiu"]) && numeros.length > 1) ? numeros[1] : null;
        return { acao: isLivre ? "GOLO_LIVRE" : "GOLO_FAVOR", jogador: numeros[0], assistencia: assist };
    }

    return null; 
}

// =====================================
// MOTOR DE VOZ (COM WATCHDOG E GRAMÁTICA)
// =====================================
let recognition = null;
let isRecognizing = false;
let watchdogTimer = null; 

function limparWatchdog() {
    if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
    }
}

window.iniciarEscutaVoz = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    
    if (!SpeechRecognition) return showToast("O browser não suporta comandos de voz.");

    if (isRecognizing) {
        if (recognition) { try { recognition.abort(); } catch(err) {} }
        limparWatchdog();
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'pt-PT';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; 

    if (SpeechGrammarList) {
        const palavrasChave = [
            'golo', 'amarelo', 'vermelho', 'substituição', 'sai', 'entra', 
            'penálti', 'livre', 'assistência', 'autogolo', 'adversário', 'favor'
        ];
        const grammar = '#JSGF V1.0; grammar futebol; public <comando> = ' + palavrasChave.join(' | ') + ' ;';
        const speechRecognitionList = new SpeechGrammarList();
        speechRecognitionList.addFromString(grammar, 1);
        recognition.grammars = speechRecognitionList;
    }

    recognition.onstart = function() {
        isRecognizing = true;
        const btn = document.getElementById('btn-mic-floating');
        if(btn) { btn.style.background = 'var(--red)'; btn.innerHTML = '🎙️'; btn.style.animation = 'pulse 1s infinite'; }
        
        watchdogTimer = setTimeout(() => {
            if (isRecognizing && recognition) {
                try { recognition.abort(); } catch(err) {}
                showToast("⚠️ O microfone não te ouviu (Tempo Esgotado).");
            }
        }, 7000);
    };

    recognition.onend = function() {
        isRecognizing = false;
        limparWatchdog();
        const btn = document.getElementById('btn-mic-floating');
        if(btn) { btn.style.background = 'var(--gold)'; btn.innerHTML = '🎤'; btn.style.animation = 'none'; }
    };

    recognition.onresult = function(event) {
        limparWatchdog(); 
        const transcript = event.results[0][0].transcript;
        processarAcaoVoz(transcript);
    };

    recognition.onerror = function(event) {
        isRecognizing = false;
        limparWatchdog();
        const btn = document.getElementById('btn-mic-floating');
        if(btn) { btn.style.background = 'var(--gold)'; btn.innerHTML = '🎤'; btn.style.animation = 'none'; }
        
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            showToast("⚠️ Erro no mic: " + event.error);
        }
    };

    try { recognition.start(); } 
    catch (err) {
        isRecognizing = false;
        if (err.name === 'NotAllowedError') showToast("⚠️ Permissão negada no browser.");
    }
};

// =====================================
// PROCESSAMENTO FINAL (Com o Grafismo Restabelecido)
// =====================================
function processarAcaoVoz(transcricao) {
    const m = getActiveMatch();
    if (!m) return showToast("Nenhum jogo em curso.");

    const intencao = interpretarComando(transcricao);
    if (!intencao) return showToast("Não percebi. Ex: 'Golo nosso, número 9'");
    if (intencao.acao === "SUBSTITUICAO_ERRO") return showToast("Diz dois números. Ex: 'Sai o 9, entra o 10'.");

    const half = window.resolveEventHalf(m);
    const currH = half === 'halftime' ? 1 : half;
    
    const isLiveTracking = state.trackSubs && m.lineup && m.lineup.length > 0 && !m.ignoreMinutes;
    const onPitchIds = isLiveTracking ? getPlayersOnPitchAtEndOfHalf(m, currH) : [];

    let pId = null;
    let pInId = null;
    let nomeJogador = "";
    let pAssistId = 'none';
    let nomeAssist = "";
    let msgUI = `<div style="font-size:11px; color:var(--muted); margin-bottom:10px;">Ouvido: "${transcricao}"</div>`;
    let cb = null;

    if (intencao.acao === "SUBSTITUICAO") {
        pId = getPlayerIdByNumber(intencao.sai);
        pInId = getPlayerIdByNumber(intencao.entra);

        if (!pId) return showToast(`Nº ${intencao.sai} não encontrado.`);
        if (!pInId) return showToast(`Nº ${intencao.entra} não encontrado.`);

        if (isLiveTracking) {
            if (!onPitchIds.includes(pId)) return showToast(`❌ O Nº ${intencao.sai} está no banco! Não pode sair.`);
            if (onPitchIds.includes(pInId)) return showToast(`❌ O Nº ${intencao.entra} já está em campo!`);
        }

        msgUI += `<div style="font-size:16px;">🔄 Substituição:<br><span style="color:var(--red);">Sai: ${playerName(pId)}</span><br><span style="color:var(--green);">Entra: ${playerName(pInId)}</span></div>`;
        cb = () => { pendingSub = { outIds: [pId], inIds: [pInId], half: half }; confirmSub(m.id, null); };
        
        return askConfirm(msgUI, cb, 'btn-gold');
    }

    const acoesSemNossoJogador = ["GOLO_CONTRA", "GOLO_CONTRA_PENALTI", "GOLO_FAVOR_AUTOGOLO", "CARTAO_AMARELO_OPP", "CARTAO_VERMELHO_OPP"];
    const precisaJogador = !acoesSemNossoJogador.includes(intencao.acao);

    if (precisaJogador) {
        if (intencao.jogador === undefined || intencao.jogador === null) return showToast("Não percebi o número do jogador.");
        pId = getPlayerIdByNumber(intencao.jogador);
        if (!pId) return showToast(`Nº ${intencao.jogador} não encontrado.`);
        
        if (isLiveTracking && !onPitchIds.includes(pId)) {
            return showToast(`❌ O Nº ${intencao.jogador} está no banco!`);
        }
        nomeJogador = playerName(pId);
    }

    if (intencao.assistencia) {
        pAssistId = getPlayerIdByNumber(intencao.assistencia);
        if (!pAssistId) return showToast(`Assistente Nº ${intencao.assistencia} não encontrado.`);
        
        if (isLiveTracking && !onPitchIds.includes(pAssistId)) {
            return showToast(`❌ O assistente Nº ${intencao.assistencia} está no banco!`);
        }
        nomeAssist = playerName(pAssistId);
    }

    switch (intencao.acao) {
        case "GOLO_FAVOR":
            msgUI += `<div style="font-size:16px;">⚽ Confirmar Golo de <b style="color:var(--gold);">${nomeJogador}</b>`;
            if (nomeAssist) msgUI += `<br><span style="font-size:13px; color:var(--muted);">Assistência: ${nomeAssist}</span>`;
            msgUI += `?</div>`;
            cb = () => addGoal(m.id, 'scored', half, pId, pAssistId, null, 'normal', 'auto');
            break;

        case "GOLO_LIVRE":
            msgUI += `<div style="font-size:16px;">🎯 Confirmar Golo de Livre de <b style="color:var(--gold);">${nomeJogador}</b>`;
            if (nomeAssist) msgUI += `<br><span style="font-size:13px; color:var(--muted);">Assistência: ${nomeAssist}</span>`;
            msgUI += `?</div>`;
            cb = () => addGoal(m.id, 'scored', half, pId, pAssistId, null, 'livre', 'auto');
            break;
            
        case "GOLO_PENALTI":
            msgUI += `<div style="font-size:16px;">🎯 Confirmar Penálti de <b style="color:var(--gold);">${nomeJogador}</b>?</div>`;
            cb = () => addGoal(m.id, 'scored', half, pId, 'none', null, 'penalti', 'auto');
            break;
            
        case "GOLO_FAVOR_AUTOGOLO":
            msgUI += `<div style="font-size:16px;">🤖 Confirmar Autogolo do Adversário (a nosso favor)?</div>`;
            cb = () => addGoal(m.id, 'scored', half, 'autogolo', 'none', null, 'autogolo', 'auto');
            break;
            
        case "AUTOGOLO_NOSSO":
            msgUI += `<div style="font-size:16px;">⚠️ Confirmar Autogolo de <b style="color:var(--red);">${nomeJogador}</b>?</div>`;
            cb = () => addGoal(m.id, 'conceded', half, pId, 'none', null, 'autogolo', 'auto');
            break;

        case "GOLO_CONTRA":
            let gkIdContra = 'auto'; let nomeGkContra = '';
            if(intencao.guardaRedes) { 
                gkIdContra = getPlayerIdByNumber(intencao.guardaRedes); 
                if(gkIdContra) nomeGkContra = playerName(gkIdContra); 
            }
            msgUI += `<div style="font-size:16px;">🥅 Confirmar Golo Sofrido?</div>`;
            if(nomeGkContra) msgUI += `<div style="font-size:12px; color:var(--muted); margin-top:4px;">Na baliza: ${nomeGkContra}</div>`;
            cb = () => addGoal(m.id, 'conceded', half, null, null, null, 'normal', gkIdContra || 'none');
            break;

        case "GOLO_CONTRA_PENALTI":
            let gkIdPenalti = 'auto'; let nomeGkPenalti = '';
            if(intencao.guardaRedes) { 
                gkIdPenalti = getPlayerIdByNumber(intencao.guardaRedes); 
                if(gkIdPenalti) nomeGkPenalti = playerName(gkIdPenalti); 
            }
            msgUI += `<div style="font-size:16px;">🎯 Confirmar Penálti Sofrido?</div>`;
            if(nomeGkPenalti) msgUI += `<div style="font-size:12px; color:var(--muted); margin-top:4px;">Na baliza: ${nomeGkPenalti}</div>`;
            cb = () => addGoal(m.id, 'conceded', half, null, null, null, 'penalti', gkIdPenalti || 'none');
            break;

        case "CARTAO_AMARELO":
            msgUI += `<div style="font-size:16px;">🟨 Amarelo para <b style="color:var(--gold);">${nomeJogador}</b>?</div>`;
            cb = () => addCard(m.id, pId, 'Amarelo', half);
            break;
            
        case "CARTAO_VERMELHO":
            msgUI += `<div style="font-size:16px;">🟥 Vermelho para <b style="color:var(--red);">${nomeJogador}</b>?</div>`;
            cb = () => addCard(m.id, pId, 'Vermelho', half);
            break;
            
        case "CARTAO_AMARELO_OPP":
            msgUI += `<div style="font-size:16px;">🟨 Amarelo para o <b style="color:var(--gold);">Adversário</b>?</div>`;
            cb = () => addCard(m.id, 'opp', 'Amarelo', half);
            break;

        case "CARTAO_VERMELHO_OPP":
            msgUI += `<div style="font-size:16px;">🟥 Vermelho para o <b style="color:var(--red);">Adversário</b>?</div>`;
            cb = () => addCard(m.id, 'opp', 'Vermelho', half);
            break;
    }

    askConfirm(msgUI, cb, 'btn-gold');
}