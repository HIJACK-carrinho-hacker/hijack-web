import type { AttackConfig } from "@hijack/protocol";

export interface SecurityExplanation {
  realWorld: string;
  inHijack: string;
}

export const ATTACK_EXPLANATIONS = {
  invertThrottle: {
    realWorld: "Se alguém comprometesse o controlador ou um ponto da comunicação sem proteção de integridade, poderia trocar o sentido de um comando. O piloto pediria frente, mas o veículo receberia ré.",
    inHijack: "O servidor inverte frente e ré enquanto o piloto dirige. A defesa de integridade bloqueia essa alteração; as paradas de segurança continuam disponíveis.",
  },
  invertSteering: {
    realWorld: "Com acesso indevido ao controlador ou à comunicação, um invasor poderia alterar o comando de direção antes de ele chegar ao veículo. Um pedido de curva à esquerda viraria uma curva à direita.",
    inHijack: "O servidor inverte o lado da direção. A defesa de integridade impede a mudança, sem atrapalhar os comandos do piloto.",
  },
  steeringBias: {
    realWorld: "Um controlador comprometido poderia acrescentar um pequeno desvio à direção, em vez de inverter tudo. O veículo puxaria para um lado mesmo quando o piloto tentasse seguir reto.",
    inHijack: "O servidor soma o desvio escolhido ao comando de direção. A defesa de integridade bloqueia esse viés.",
  },
  lockSteering: {
    realWorld: "Uma falha explorada no controlador poderia manter um valor antigo de direção e ignorar as correções seguintes. O veículo continuaria apontando para o mesmo lado, apesar das tentativas do piloto.",
    inHijack: "O servidor guarda a primeira direção recebida após ligar o ataque e a mantém nos comandos seguintes. A defesa de integridade bloqueia o travamento.",
  },
  replay: {
    realWorld: "Um invasor poderia reapresentar uma mensagem válida registrada antes. Sem verificar se ela é nova e pertence à sessão atual, o receptor poderia aceitar uma ordem antiga como se tivesse acabado de chegar.",
    inHijack: "O servidor reaplica o pedido do piloto de 5 segundos atrás enquanto há pedido atual de tração. A defesa de repetição recusa esse replay no servidor.",
  },
  delayMs: {
    realWorld: "Quem controlasse um ponto do caminho da comunicação poderia reter mensagens antes de encaminhá-las. O veículo reagiria tarde aos comandos, prejudicando o controle. Lentidão também pode ocorrer sem ataque.",
    inHijack: "O servidor atrasa os comandos pelo tempo escolhido. Paradas não são atrasadas e cancelam os comandos pendentes. As quatro defesas não eliminam esse ataque de disponibilidade.",
  },
  dropPct: {
    realWorld: "Um equipamento de rede comprometido poderia descartar parte das mensagens de controle. O veículo receberia comandos com interrupções. Congestionamento e sinal ruim também podem causar perdas, sem invasão.",
    inHijack: "O servidor descarta comandos em rajadas de meio segundo, com a chance escolhida. Parar nunca é descartado; sem comandos novos, o watchdog para o carrinho. As quatro defesas não evitam a perda.",
  },
  intercept: {
    realWorld: "Alguém com acesso ao caminho dos dados poderia observar mensagens transmitidas sem criptografia e entender o que está sendo enviado. Estar na mesma rede, por si só, não garante acesso a todo o tráfego.",
    inHijack: "O painel exibe cópias das mensagens do próprio servidor, sem capturar a rede. A defesa de criptografia só embaralha essa visualização; a conexão real continua sem TLS.",
  },
  crackPassword: {
    realWorld: "Senhas padrão ou previsíveis podem ser descobertas por tentativas com combinações comuns. Uma senha longa e exclusiva, junto com limites de tentativas, dificulta esse tipo de adivinhação.",
    inHijack: "O servidor simula um ataque de dicionário com uma lista fixa e verifica se a senha padrão ainda está ativa. Trocar a senha de verdade bloqueia essa demonstração.",
  },
  jamLink: {
    realWorld: "Uma negação de serviço poderia tornar a comunicação indisponível, por sobrecarga ou interferência no enlace. O veículo deixaria de receber ordens; uma falha comum de rede pode produzir o mesmo efeito.",
    inHijack: "O servidor suspende os comandos por 5 segundos e para o carrinho, sem derrubar o Wi-Fi. As quatro defesas não restauram o link; o failsafe limita o risco ao parar o veículo.",
  },
  spoofTelemetry: {
    realWorld: "Um sensor, controlador ou canal de dados comprometido poderia informar um estado falso. O painel indicaria uma situação normal enquanto o veículo estivesse fazendo outra coisa, enganando quem o monitora.",
    inHijack: "Só o monitor do defensor mostra o comando solicitado como se fosse o confirmado. A defesa de integridade restaura a telemetria verdadeira; o estado real do carrinho não muda por esse ataque.",
  },
  hijack: {
    realWorld: "Com uma credencial roubada ou uma falha de autorização, um invasor poderia se passar por um controlador legítimo e enviar ordens ao veículo. O sistema precisa verificar quem pode controlar cada dispositivo.",
    inHijack: "O servidor permite ao atacante dirigir e ignora o piloto enquanto a senha padrão está ativa. Trocar a senha encerra e bloqueia o sequestro. Soltar o analógico do atacante, STOP geral e watchdogs continuam parando o carrinho.",
  },
} satisfies Record<keyof AttackConfig | "crackPassword" | "jamLink", SecurityExplanation>;

export const DEFENSE_EXPLANATIONS = {
  authentication: {
    realWorld: "Autenticação verifica a identidade de quem pede acesso; autorização define o que essa pessoa pode controlar. Substituir senhas padrão por senhas longas e exclusivas reduz a chance de acesso por adivinhação.",
    inHijack: "A troca de senha é real: a antiga deixa de funcionar, o piloto precisa entrar novamente e o sequestro é encerrado. No jogo, ela também bloqueia a quebra de senha e novos sequestros.",
  },
  integrity: {
    realWorld: "Uma verificação criptográfica, como um código de autenticação de mensagem (MAC), permite detectar alterações nos dados e verificar sua origem. Se a verificação falhar, o receptor deve recusar a mensagem.",
    inHijack: "O interruptor faz o servidor bloquear inversões, viés, travamento e telemetria falsa. É uma simulação: não adiciona HMAC nem validação criptográfica ao ESP32. Não bloqueia atraso, perda ou queda do link.",
  },
  replay: {
    realWorld: "O receptor precisa conferir se uma mensagem é nova, usando contadores ou identificadores únicos vinculados à sessão e protegidos contra alteração. Uma mensagem autêntica ainda pode ser antiga; integridade sozinha não prova que ela é nova.",
    inHijack: "O servidor recusa o replay simulado e pode registrar um exemplo de comando antigo bloqueado. Esse interruptor não adiciona uma proteção criptográfica contra repetição ao firmware.",
  },
  encryption: {
    realWorld: "Um canal protegido, como TLS com verificação da identidade do servidor, impede que observadores leiam o conteúdo das mensagens em trânsito. Isso não impede que alguém interrompa a comunicação.",
    inHijack: "O interruptor embaralha apenas os textos exibidos na interceptação. É uma simulação, não TLS: a rede continua em texto claro e atraso, perda e queda do link ainda podem acontecer.",
  },
} satisfies Record<string, SecurityExplanation>;
