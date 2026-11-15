export const PROTOCOL_VERSION = 1 as const;

export const MAX_MESSAGE_BYTES = 2048;

export const TEAM_IDS = ["A", "B"] as const;
export const CAR_IDS = ["car-a", "car-b"] as const;
export const PARTICIPANT_ROLES = ["pilot", "hacker"] as const;
export const ROLES = ["pilot", "hacker", "admin"] as const;
export const CAR_MODES = ["simulated", "hardware"] as const;
export const DEMO_STATES = ["setup", "ready", "running", "paused", "stopped"] as const;
export const DEMO_TOPOLOGIES = ["single", "dual"] as const;

export const ATTACK_STEPS = ["locked", "scan", "target", "exploit", "manipulate"] as const;

export const PILOT_STOP_REASONS = [
  "release",
  "blur",
  "hidden",
  "unmount",
  "disconnect",
  "manual",
] as const;

export const STOP_REASONS = [
  "boot",
  "pilot-release",
  "pilot-stop",
  "pilot-disconnected",
  "session-revoked",
  "watchdog",
  "demo-not-running",
  "admin-stop-all",
  "device-disconnected",
  "server-restart",
  "mode-change",
  "fault",
  "link-jammed",
  "hijack-start",
  "hijack-release",
] as const;

export const DEFAULT_COMMAND_TTL_MS = 400;
export const STEERING_MAX = 100;
export const PILOT_REFRESH_MS = 100;
export const PILOT_SEND_MIN_INTERVAL_MS = 50;
export const MAX_DEVICE_COMMANDS_PER_SECOND = 20;
export const MAX_BROWSER_MESSAGES_PER_SECOND = 10;
export const BROWSER_MESSAGE_BURST = 20;
export const MAX_PILOT_MESSAGES_PER_SECOND = 40;
export const CONFIRMED_STALE_MS = 1500;
export const RATE_LIMIT_NOTICE_MS = 1000;

export const STEERING_BIAS_MAX = 40;
export const STEERING_BIAS_STEP = 5;
export const ATTACK_DELAYS_MS = [0, 150, 300] as const;
export const ATTACK_DROP_PCTS = [0, 30, 60] as const;
export const REPLAY_DELAY_MS = 5000;
export const REPLAY_HISTORY_MS = 10000;
export const JAM_MS = 5000;
export const JAM_COOLDOWN_MS = 10000;
export const INTERCEPT_LOG_SIZE = 15;
export const CRACK_DICTIONARY = [
  "123456",
  "password",
  "admin",
  "qwerty",
  "senha",
  "0000",
  "1111",
  "12345",
  "abc123",
  "1234",
  "carrinho",
  "hijack",
  "esp32",
  "123123",
  "iloveyou",
  "senha123",
  "admin123",
  "102030",
  "batata",
  "brasil",
] as const;

export const DEFAULT_CAR_PASSWORD = "1234";
export const MIN_STRONG_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 32;

export const TEAM_OF_CAR = { "car-a": "A", "car-b": "B" } as const;
export const CAR_OF_TEAM = { A: "car-a", B: "car-b" } as const;
export const OPPONENT_CAR = { A: "car-b", B: "car-a" } as const;
export const SINGLE_TOPOLOGY_CAR = "car-a" as const;
export const SINGLE_TOPOLOGY_ATTACKER = "B" as const;

export const ERROR_CODES = [
  "bad_request",
  "message_too_large",
  "unsupported_version",
  "unknown_type",
  "invalid_payload",
  "unauthenticated",
  "forbidden",
  "slot_taken",
  "invalid_credentials",
  "rate_limited",
  "demo_not_running",
  "attack_step_invalid",
  "weak_password",
  "car_offline",
  "release_required",
  "hijacked",
  "link_jammed",
  "internal",
] as const;
