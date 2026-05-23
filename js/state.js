/* ── STATE: ตัวแปร global ทั้งหมด ── */
let tools          = [];
let currentToolId  = null;
let selectedYear   = 'all';
let searchTimer;
let updatedFields  = [];
let departments    = [];
let justUpdatedId  = null;
let types          = [];
let locations      = [];
let settingsInitialized = false;

/* ── AUTH ── */
let currentUser = null;

/* Instruments sort */
let sortCol = 'expire';
let sortDir = 1;

/* Alerts filter */
let alertFilter  = 'all';
let selectedDate = null;

/* Toast timer */
let toastTimer = null;

/* Search Timer */
let typeSearchTimer;
let locSearchTimer;

/* Calibration history cache */
let calHistory        = [];
let calHistoryLoaded  = false;