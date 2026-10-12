# V: O Arquiteto da Realidade

Sandbox 2D de exploração e manipulação da realidade, baseado no romance
**V — O Homem Que Acordou Grande Demais**. Feito em HTML, CSS e JavaScript puro
(Canvas 2D), sem engine, sem dependências e sem arquivos de imagem: toda a pixel art
é desenhada por código.

> Estado atual: **Etapa 1 — protótipo jogável** (Ato I, capítulos 1 e 2, mais uma pequena área externa).

---

## Como executar

1. Baixe/clone o repositório.
2. Abra `index.html` no navegador (Chrome, Edge ou Firefox recentes). Dá para abrir
   direto do disco (duplo clique). Não precisa de servidor.
3. Opcional, se o seu navegador bloquear algo em `file://`: rode um servidor local
   na pasta do projeto, por exemplo `npx http-server -c-1 .` ou
   `python3 -m http.server`, e abra o endereço indicado.

O progresso fica no `localStorage` do navegador (3 espaços manuais + 1 automático).

## Controles (remapeáveis em Configurações)

| Tecla | Ação |
|---|---|
| A / D ou ← / → | Andar |
| Shift (segurar) | Correr |
| W, Espaço ou ↑ | Pular (segure para ir mais alto) · no ar, de novo: voar (depois do capítulo 2) · no voo: subir |
| S ou ↓ | Na escada, segurar para pegar o lance de descida · descer de patamares · no voo: descer |
| E ou Enter | Interagir / avançar diálogo |
| 1–7 ou roda do mouse | Escolher poder |
| Botão esquerdo | Usar o poder (segurar/arrastar/clicar) |
| Botão direito | Pousar objeto com cuidado / cancelar seleção / trocar o que Criar faz |
| C (segurar) | Precisão (Levitar) e firmeza (cenas) |
| Q | Cancelar poder |
| J ou Tab | Caderno |
| I | Bolsos (inventário) |
| Esc ou P | Pausa, salvar, carregar, configurações |

## Como a Etapa 1 representa o início da história

O jogo começa exatamente onde o romance começa: **terça-feira de janeiro, 7h19**, no
apartamento de 42 m² de V.

- **Capítulo 1 — O Copo.** V lava o copo de requeijão; ele escorrega da mão molhada e
  **para a quinze centímetros do chão**, com uma gota suspensa (o mundo perde a cor por
  um instante). V cutuca o copo, ele quebra, V ri. Ao ir buscar a vassoura, pensa
  *"eu queria que isso não tivesse acontecido"*, e o copo volta inteiro para a pia: assim
  nasce a **Restauração**. Depois ele aponta: *"Sobe."*, e nasce a **Levitação**. Vêm a
  geladeira ("Cadê o manual"), a mensagem para o chefe e o caderno *Coisas que eu consigo
  fazer (dia 1)*: entortar e desentortar a colher, o controle remoto que atravessa a
  sala sem percorrer o caminho, a cor do abajur (aceso e apagado), a laranja perfeita.
  O dia termina na janela: *"E se não for só copo?"*
- **Capítulo 2 — Testes Domésticos.** Dia 2: a parede transparente e o vizinho de cueca
  ("NÃO FAZER ISSO NUNCA MAIS", e V passa a se recusar a usar Percepção ali), a água com
  gosto de coca-cola e a tentativa de voar que termina com a cabeça no teto e uma bolsa
  de gelo. Dia 3: o teste sério, a cicatriz no joelho, e **A Linha**, uma sequência em
  que o jogador precisa segurar a avó, o primo, a casa e o café coado antes que o fio
  arrebente. Não é combate. À noite vem uma escolha de postura e a frase *"Eu prefiro
  carregar a culpa de ter feito."* Dia 4, 7h19: *"E foi assim, por pura solidão, que ele
  criou a Van."*

### O que é do romance e o que é original

- Falas com o rótulo **"Narração · do romance"** citam ou condensam o livro.
- Tudo com o selo **◆ ORIGINAL** foi criado para o jogo: as missões secundárias, as falas
  das pessoas da rua, a padaria, o segredo do telhado, a escolha da noite do dia 3 e a
  mecânica da Linha.
- A rua é liberdade de sandbox. No romance, V fica 19 dias sem sair (cap. 6). As cenas da
  rua (o cachorro puxando a pessoa, a moto na calçada, a senhora e a chave, o casal
  discutindo) são as que ele vê da janela no capítulo 1.

## A Linha: por que não há barra de mana

No capítulo 2, V descobre que "a realidade é feita inteira de uma linha só": puxar um fio
arrasta todo o resto. No jogo, **cada poder tensiona a Linha**. A tensão relaxa sozinha
quando V para. Se passar do limite, a Linha **desfia**: o que ele segura cai, ele cambaleia,
e alguma coisa frágil por perto pode quebrar (e aí é preciso restaurar, o que puxa mais).

- O limite cresce com **Compreensão**, que vem de descobertas, missões e escolhas, não de
  repetir o mesmo poder. Os poderes de V "obedeciam à necessidade", não à disciplina.
- O **estado emocional** (calmo, curioso, irritado, assustado, pânico, exausto) muda o
  custo e o relaxamento. Pânico deixa tudo mais barato e mais perigoso.

## Poderes da Etapa 1

| # | Poder | Origem no romance | O que faz |
|---|---|---|---|
| 1 | Levitar | "Sobe." / "Desce." | Erguer, puxar, empurrar e arremessar objetos. O custo depende da massa. |
| 2 | Restaurar | o copo que volta para a pia | Desfaz o que aconteceu com um objeto: cacos viram copo, o que caiu volta para onde estava. |
| 3 | Deslocar | o controle remoto que atravessa a sala | Leva um objeto a outro ponto sem percorrer o caminho. |
| 4 | Transformar | a colher, o abajur, o gosto da água | Muda forma, cor, gosto e material (caixote de madeira ↔ ferro). |
| 5 | Criar | a laranja perfeita | Faz uma laranja existir. Outras criações virão com a campanha. |
| 6 | Percepção | a parede transparente | Enxerga através das coisas: segredos, a bolsa da senhora, o interior dos apartamentos (olhar a casa dos outros pesa na Linha). |
| 7 | Teleporte | extensão original (liberado ao fim do cap. 2) | V aparece num lugar livre ao alcance sem percorrer o caminho. |

Criar começa só com a laranja (canônica); depois de comê-la, faz maçã, banana, pão, café e chocolate,
e no fim da etapa, dinheiro (com consequências: a atendente pode desconfiar de notas "novas demais").

O voo aparece como evento do capítulo 2 (bater a cabeça no teto). Depois do fim do capítulo, fica
liberado: pule e, no ar, aperte Pular de novo para entrar em voo controlado (W/S sobem e
descem, A/D movem, Shift acelera). Encostar no chão encerra o voo; enquanto dura, gasta a Linha.

### Pessoas que reagem

Quem estiver perto e no mesmo ambiente **vê** o que V faz (objetos flutuando, coisas aparecendo,
teleporte, voo) e reage: espanto, comentários, fuga. Objetos arremessados podem acertar alguém.
Todo mundo conversa (E) e lembra do que viu. O caderno conta quantas pessoas já viram algo
impossível. Missões secundárias originais: a pipa do menino (com escolha sobre contar a verdade),
a chave da senhora, a entrega do 32, os pequenos consertos, as terças-feiras, os experimentos e o
segredo do telhado (que pode terminar devolvendo a chave ao porteiro, Seu Valdir).

## O que já funciona

- Menu inicial com cenário animado, pausa, configurações (volume, tremor de tela, reduzir
  flashes, FPS, escala da tela, remapeamento de teclas), tela de controles e tela "Sobre".
- Movimento com aceleração, atrito, coyote time, buffer de pulo, pulo variável e corrida;
  colisão em sub-passos (não atravessa o chão nem prende na parede); escada em degraus no estilo
  Terraria: é só andar que V sobe os lances (segurar S na bifurcação pega o lance de descida),
  com patamares, quinas que não prendem e o alçapão do telhado barrando a subida quando fechado.
- Câmera com suavização e antecipação, mundo de 150×50 blocos maior que a tela.
- Apartamento completo (cozinha, sala, quarto, hall, banheiro), prédio de 4 andares com
  escada e telhado, terreno baldio, rua, praça e padaria.
- Objetos com física: empilhar, empurrar, arremessar, quebrar (copo, garrafa) e restaurar
  por rebobinamento do histórico de posições.
- Os seis poderes, com a Linha, emoções e consequências.
- Personagens em pixel art de alta resolução (o dobro de pixels do mundo, ~64 px de altura),
  montados sobre um esqueleto: as pernas usam cinemática inversa (ficam presas ao quadril e os
  pés plantados no chão durante a passada), braços com cotovelo, ciclo de andar em 12 quadros e
  de corrida em 10, respiração, piscar, pulo, queda, voo, sentar, varrer, carregar, tontura,
  deitado e braço que aponta para o cursor. V usa moletom azul com capuz, cordões e bolso
  canguru, jeans e tênis branco, e fica com as mãos no bolso quando parado.
- Efeitos dos poderes e partículas também em alta resolução: fio de energia da Levitação,
  cantoneiras animadas nos alvos, mostrador de relógio na Restauração, coluna de luz no
  Teleporte, borda tremulando na Percepção, faíscas e estrelinhas.
- Cenário vivo: árvore e arbustos com folhagem detalhada balançando, folhas caindo, grama,
  borboletas, mariposas nos postes à noite, vapor na padaria, poeira na luz da sala e um gato de
  rua no terreno baldio (conteúdo original).
- Pessoas que se assustam correm alguns passos, se encolhem olhando para V e depois voltam ao
  lugar; a mesma coisa repetida (voar perto de novo) não reinicia o susto a cada instante.
- Ciclo de dia e noite com céu, sol, lua, estrelas, nuvens fofas, cidade em cinco camadas de
  paralaxe (morros, prédios com caixas d'água, antenas e letreiros, viaduto com trânsito,
  árvores), pássaros e avião, janelas acesas à noite, fachada da padaria com cortinas,
  floreiras, ar-condicionado e toldo, iluminação dinâmica (lustres, abajur colorido, TV, postes, padaria).
- Efeitos: tempo parado (dessaturação), rebobinar (ondas e glifos de relógio), raio de
  Percepção, distorção quando a Linha estica e falha visual quando desfia.
- História dos capítulos 1 e 2 com objetivos, listas de tarefas, diálogos com digitação,
  escolhas e cartões de capítulo.
- Caderno (descobertas por dia, registros, missões, poderes), bolsos com usar e largar.
- Três missões secundárias originais, incluindo o segredo do telhado (Percepção → Levitar o
  painel → chave → alçapão → registro).
- Pessoas da rua com comportamentos próprios, pombos que voam quando V chega perto.
- Salvamento: posição, relógio, poderes, Linha, bolsos, objetos (quebrados, transformados,
  criados), portas, história, caderno e missões. Salvamento automático em pontos seguros.
- Tratamento de erros: saves corrompidos são detectados e erros inesperados abrem um painel
  com a mensagem, em vez de travar em silêncio.

## O que ainda está pendente (próximas etapas)

- **Etapa 2 — Sandbox:** mineração e colocação de blocos, subterrâneo (o bueiro já está lá),
  coleta, baús, estações e receitas de fabricação, expansão do mundo além da barreira.
- **Etapa 3 — Poderes e combate:** voo controlado, teleporte de V, parar/desacelerar o tempo
  em área, inimigos originais, dano, esquiva e o primeiro chefe.
- **Etapa 4 — A Van e a Mansão Viva:** a Van comunicando-se por faróis, rádio, limpadores,
  buzina e motor; a Mansão pela porta do banheiro, mudando com o estado de V.
- **Etapa 5 — Gustavo, Téo e decisões** (caps. 4–16, incluindo o determinismo forçado).
- **Etapa 6 — Agência, Diretor Mark, Rayan/Eclipse e o Entre.**
- **Etapa 7 — Expansão cósmica:** Fray, Noc, Império Estalar, a borda e Trigg.
- Sons são sintetizados e simples; ainda não há música.

## Estrutura do projeto

```
index.html        página, camadas de interface e ordem dos scripts
style.css         interface (HUD, menus, caderno, bolsos)
js/core.js        namespace VG, constantes, utilidades, barramento de eventos
js/world.js       blocos, mundo, diffs para salvar e o cenário da Etapa 1
js/physics.js     colisão AABB com sub-passos e plataformas de mão única
js/entities.js    objetos físicos (histórico para Restauração), itens, pessoas, pombos
js/particles.js   partículas
js/input.js       teclado e mouse com ações remapeáveis
js/audio.js       efeitos sonoros sintetizados (WebAudio)
js/player.js      controle e animação de V
js/powers.js      sistema modular de poderes, a Linha e emoções
js/inventory.js   bolsos e catálogo de itens
js/story.js       diálogos, passos da campanha, sequência "A Linha", missões secundárias
js/interact.js    objetos interativos fixos e portas
js/save.js        salvar, carregar, validar e configurações
js/characters.js  personagens em alta resolução: esqueleto, cinemática inversa, rasterização própria
js/ambient.js     vida do cenário (folhagem, insetos, gato, vapor, poeira)
js/pix.js         ferramentas de pixel art da grade fina (tons, contorno, sprites em cache)
js/art/tiles.js     blocos e paredes (32×32 px)
js/art/interior.js  móveis e objetos de dentro dos prédios
js/art/props.js     objetos físicos e estruturas da praça
js/art/exterior.js  rua, praça, padaria, telhado, veículos e animais
js/art/skyline.js   céu, nuvens, sol/lua e cidade em camadas
tests/look.js       captura de tela de qualquer ponto do mapa
js/sprites.js     pixel art procedural (objetos, móveis, veículos, ícones)
js/render.js      câmera, céu, paralaxe, blocos, luz e efeitos
js/ui.js          interface em DOM
js/main.js        laço com passo fixo, estados, interação, transições e erros
tests/unit.js     testes das mecânicas (Node, sem navegador)
tests/playthrough.js  teste de ponta a ponta: joga a Etapa 1 inteira no Chromium
```

### Como estender

- **Novo poder:** registre um objeto em `G.POWERS` (ganchos `down`, `hold`, `up`, `alt`,
  `update`, `cancel`) em `js/powers.js` e acrescente o id em `G.POWER_ORDER`.
- **Novo passo de história:** acrescente em `G.STORY_STEPS` (`objective`, `enter`, `on`,
  `intercept`, `update`, `allowSleep`, `safe`) e chame `st.go('id')`.
- **Novo objeto físico:** acrescente em `G.PropTypes` e desenhe o tipo em
  `Sprites.prop`.
- **Novo bloco:** acrescente em `G.T`/`G.TILES` e a textura em `drawTile` (`js/render.js`).

## Testes

```bash
node tests/unit.js                 # 37 testes de física, escada, voo, poderes, objetos, pessoas, bolsos e salvamento
```

O teste de ponta a ponta precisa do Playwright:

```bash
npm install                        # instala o playwright (devDependency)
npx playwright install chromium
node tests/playthrough.js [pasta-para-capturas]
```

Ele abre o jogo, começa um novo jogo e joga a Etapa 1 do começo ao fim com teclado e mouse
reais. Depois completa as missões secundárias, salva, carrega, remapeia teclas e verifica
que o console não registrou erros.
