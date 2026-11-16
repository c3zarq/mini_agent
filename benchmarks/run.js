'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const OLLAMA_URL = (
    process.env.OLLAMA_HOST || 'http://localhost:11434'
).replace(/\/+$/, '');

const MODELS = [
    'qwen3:1.7b',
    'phi4-mini:latest',
    'qwen2.5-coder:0.5b'
];

const TASKS = [
    {
        id: 'T01',
        title: 'Interpretação de requisitos',
        prompt: `
Considere os seguintes requisitos de um agente local de desenvolvimento:

1. O sistema permite cadastrar projetos.
2. Cada projeto está associado a um diretório raiz.
3. Cada projeto pode possuir várias sessões de conversa.
4. As mensagens das sessões são persistidas em SQLite.
5. O agente pode consultar arquivos, mas somente dentro do diretório raiz autorizado.
6. As tarefas são carregadas de um documento EAP.md.
7. A sincronização da EAP não deve duplicar tarefas nem apagar estados já registrados.

Produza:
a) Um resumo do funcionamento esperado, em 3 a 5 frases.
b) Exatamente 7 requisitos verificáveis, um para cada requisito informado.
c) Três riscos ou ambiguidades que mereçam atenção.

Não escreva código. Não invente funcionalidades. Responda em português brasileiro.
`
    },
    {
        id: 'T02',
        title: 'Raciocínio e segurança',
        prompt: `
Um agente possui o seguinte diretório raiz autorizado:

/home/cezar/data/projeto

Analise os seguintes caminhos solicitados:

A) docs/README.md
B) ../segredo.txt
C) /etc/passwd
D) ../projeto-backup/arquivo.txt
E) docs/atalho/segredo.txt

Considere que, no caso E, "docs/atalho" é um link simbólico que aponta para:

/home/cezar/private

F) docs/../tasks/T014.md

Para cada caminho, informe se deve ser autorizado ou rejeitado e explique brevemente.

Depois, descreva um algoritmo seguro de validação de caminhos em Node.js, considerando:
- caminhos relativos e absolutos;
- normalização de caminhos;
- links simbólicos;
- tentativa de escapar do diretório autorizado;
- diferença entre um diretório cujo nome começa com o nome do diretório autorizado e um verdadeiro subdiretório.

Não escreva código. Responda em português brasileiro, com no máximo 300 palavras.
`
    },
    {
        id: 'T03',
        title: 'Programação JavaScript',
        prompt: `
Implemente uma função JavaScript chamada isPathInside(projectRoot, requestedPath).

Requisitos:
1. Utilize apenas módulos nativos do Node.js.
2. Utilize CommonJS.
3. O primeiro parâmetro representa o diretório raiz autorizado.
4. O segundo parâmetro pode ser um caminho absoluto ou relativo ao diretório raiz.
5. Ambos os caminhos representam locais existentes no sistema de arquivos.
6. A função retorna true quando o destino é o próprio diretório raiz ou um descendente dele.
7. A função deve resolver links simbólicos antes de verificar a autorização.
8. Deve retornar false para caminhos inválidos, vazios, inexistentes ou que não possam ser acessados.
9. Não deve confundir um diretório chamado projeto-backup com um subdiretório chamado projeto.

Entregue dois arquivos separados:

Arquivo 1: isPathInside.js
Arquivo 2: isPathInside.test.js

O segundo arquivo deve utilizar o módulo nativo node:test e criar seus próprios diretórios e arquivos temporários.

Inclua testes para:
- caminho absoluto autorizado;
- caminho relativo autorizado;
- tentativa de acesso com ../;
- diretório com prefixo semelhante ao autorizado;
- link simbólico apontando para fora do diretório;
- o próprio diretório raiz;
- argumentos inválidos.

Não utilize bibliotecas externas. Não omita os testes. Responda em português brasileiro.
`
    }
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseName = `results-${stamp}`;

const jsonPath = path.join(__dirname, `${baseName}.json`);
const markdownPath = path.join(__dirname, `${baseName}.md`);

const results = {
    createdAt: new Date().toISOString(),
    ollamaUrl: OLLAMA_URL,
    configuration: {
        temperature: 0,
        seed: 42,
        num_ctx: 8192,
        num_predict: 900
    },
    models: []
};

function seconds(nanoseconds) {
    return typeof nanoseconds === 'number'
        ? nanoseconds / 1e9
        : null;
}

function tokensPerSecond(tokens, duration) {
    if (
        typeof tokens !== 'number' ||
        typeof duration !== 'number' ||
        duration <= 0
    ) {
        return null;
    }

    return tokens / (duration / 1e9);
}

function format(value, decimals = 2) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value.toFixed(decimals)
        : '-';
}

async function postJson(endpoint, payload, timeout = 300000) {
    const response = await fetch(`${OLLAMA_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout)
    });

    const raw = await response.text();

    let data;

    try {
        data = raw ? JSON.parse(raw) : {};
    } catch {
        throw new Error('Ollama retornou uma resposta JSON inválida.');
    }

    if (!response.ok) {
        throw new Error(
            data.error || `Erro HTTP ${response.status}`
        );
    }

    return data;
}

async function getRunningModel(model) {
    const response = await fetch(`${OLLAMA_URL}/api/ps`, {
        signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
        throw new Error(`Falha ao consultar modelos carregados: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.models)) {
        throw new Error('Formato inesperado na resposta de /api/ps.');
    }

    return data.models.find(item =>
        item.name === model || item.model === model
    ) || null;
}

function megabytes(bytes) {
    return typeof bytes === 'number'
        ? bytes / (1024 * 1024)
        : null;
}

async function checkModels() {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
        throw new Error(`Falha ao consultar Ollama: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.models)) {
        throw new Error('Resposta inesperada ao consultar modelos.');
    }

    const available = data.models.map(item => item.name);

    const missing = MODELS.filter(model =>
        !available.includes(model)
    );

    if (missing.length > 0) {
        throw new Error(
            `Modelos não encontrados: ${missing.join(', ')}`
        );
    }

    console.log('Modelos encontrados:');

    for (const model of MODELS) {
        console.log(`- ${model}`);
    }
}

function saveResults() {
    fs.writeFileSync(
        jsonPath,
        JSON.stringify(results, null, 2)
    );

    fs.writeFileSync(
        markdownPath,
        buildMarkdown()
    );
}

function buildMarkdown() {
    let output = '# Benchmark de modelos locais\n\n';

    output += `Data: ${results.createdAt}\n\n`;

    output += '## Configuração\n\n';
    output += '```json\n';
    output += JSON.stringify(results.configuration, null, 2);
    output += '\n```\n\n';

    output += '## Comparação de desempenho\n\n';

    output += '| Modelo | Teste | Carga (s) | API total (s) | Memória modelo (MB) | VRAM (MB) | Contexto | Geração (tok/s) | Tokens |\n';
    output += '|---|---|---:|---:|---:|---:|---:|---:|---:|\n';

    for (const model of results.models) {
        for (const test of model.tests) {
            const m = test.metrics || {};

            output += `| ${model.model} | ${test.id} | `;
            output += `${format(m.load_seconds)} | `;
            output += `${format(m.total_seconds)} | `;
            output += `${format(m.model_memory_estimate_mb)} | `;
            output += `${format(m.vram_mb)} | `;
            output += `${m.context_length ?? '-'} | `;
            output += `${format(m.generation_tokens_per_second)} | `;
            output += `${m.output_tokens ?? '-'} |\n`;
        }
    }

    for (const model of results.models) {
        output += `\n## ${model.model}\n`;

        for (const test of model.tests) {
            output += `\n### ${test.id} — ${test.title}\n\n`;

            if (test.error) {
                output += `**Erro:** ${test.error}\n`;
                continue;
            }

            const m = test.metrics;

            output += `**Tempo total medido:** ${format(m.wall_seconds)} s\n\n`;
            output += `**Tempo de carregamento:** ${format(m.load_seconds)} s\n\n`;
            output += `**Velocidade de geração:** ${format(m.generation_tokens_per_second)} tokens/s\n\n`;
            output += `**Memória estimada fora da VRAM:** ${format(m.model_memory_estimate_mb)} MB\n\n`;
            output += `**Tamanho do modelo carregado:** ${format(m.model_size_mb)} MB\n\n`;
            output += `**VRAM:** ${format(m.vram_mb)} MB\n\n`;
            output += `**Contexto:** ${m.context_length ?? '-'} tokens\n\n`;
            output += `**Motivo do término:** ${test.done_reason || '-'}\n\n`;

            if (m.memory_measurement_error) {
                output += `**Erro ao medir memória:** ${m.memory_measurement_error}\n\n`;
            }

            output += '#### Resposta do modelo\n\n';
            output += `${test.answer || '(Resposta vazia)'}\n`;
        }
    }

    return output;
}

async function unloadModel(model) {
    try {
        await postJson(
            '/api/generate',
            {
                model,
                keep_alive: 0
            },
            30000
        );

        console.log(`Modelo descarregado: ${model}`);

    } catch (error) {
        console.warn(
            `Não foi possível descarregar ${model}: ${error.message}`
        );
    }
}

async function runModel(model) {
    console.log('\n========================================');
    console.log(`MODELO: ${model}`);
    console.log('========================================');

    const modelResult = {
        model,
        tests: []
    };

    results.models.push(modelResult);

    for (const task of TASKS) {
        console.log(`\nExecutando ${task.id}: ${task.title}`);

        const started = performance.now();

        try {
            const data = await postJson('/api/chat', {
                model,
                messages: [
                    {
                        role: 'system',
                        content: 'Responda em português brasileiro. Siga exatamente as instruções do usuário.'
                    },
                    {
                        role: 'user',
                        content: task.prompt
                    }
                ],
                stream: false,
                keep_alive: '10m',
                options: {
                    temperature: 0,
                    seed: 42,
                    num_ctx: 8192,
                    num_predict: 900
                }
            });

            const wallMs = performance.now() - started;

            let runtime = null;
            let runtimeError = null;

            try {
                runtime = await getRunningModel(model);
            } catch (error) {
                runtimeError = error.message;
            }

            const modelSize = runtime?.size ?? null;
            const vramSize = runtime?.size_vram ?? null;

            const metrics = {
                model_memory_estimate_mb:
                    modelSize === null
                        ? null
                        : megabytes(Math.max(0, modelSize - (vramSize || 0))),
                model_size_mb: megabytes(modelSize),
                vram_mb: megabytes(vramSize),
                context_length: runtime?.context_length ?? null,
                parameter_size: runtime?.details?.parameter_size ?? null,
                memory_measurement_error: runtimeError,
                wall_seconds: wallMs / 1000,
                total_seconds: seconds(data.total_duration),
                load_seconds: seconds(data.load_duration),
                prompt_seconds: seconds(data.prompt_eval_duration),
                generation_seconds: seconds(data.eval_duration),
                prompt_tokens: data.prompt_eval_count ?? null,
                output_tokens: data.eval_count ?? null,
                prompt_tokens_per_second: tokensPerSecond(
                    data.prompt_eval_count,
                    data.prompt_eval_duration
                ),
                generation_tokens_per_second: tokensPerSecond(
                    data.eval_count,
                    data.eval_duration
                )
            };

            const testResult = {
                id: task.id,
                title: task.title,
                metrics,
                answer: data.message?.content || '',
                done_reason: data.done_reason ?? null
            };

            modelResult.tests.push(testResult);

            console.log(`Tempo total: ${format(metrics.total_seconds)} s`);
            console.log(`Carregamento: ${format(metrics.load_seconds)} s`);
            console.log(`Geração: ${format(metrics.generation_tokens_per_second)} tokens/s`);
            console.log(`Tokens gerados: ${metrics.output_tokens ?? '-'}`);
            console.log(`Memória estimada do modelo fora da VRAM: ${format(metrics.model_memory_estimate_mb)} MB`);
            console.log(`VRAM: ${format(metrics.vram_mb)} MB`);
            console.log(`Contexto: ${metrics.context_length ?? '-'}`);

        } catch (error) {
            modelResult.tests.push({
                id: task.id,
                title: task.title,
                error: error.message
            });

            console.error(`Falha em ${task.id}: ${error.message}`);
        }

        saveResults();
    }

    await unloadModel(model);
    saveResults();
}

async function main() {
    console.log('BENCHMARK DO MINI AGENT');
    console.log('Verificando conexão com Ollama...\n');

    await checkModels();

    console.log('\nIniciando testes sequenciais.');

    for (const model of MODELS) {
        await runModel(model);
    }

    console.log('\n========================================');
    console.log('BENCHMARK FINALIZADO');
    console.log('========================================');

    console.log(`JSON: ${jsonPath}`);
    console.log(`Markdown: ${markdownPath}`);
}

main().catch(error => {
    console.error('\nErro no benchmark:', error.message);
    process.exitCode = 1;
});
