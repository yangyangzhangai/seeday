import type { TranslationKeys } from './en';

const it: TranslationKeys = {
    // ── Comune ──
    app_name: 'Time Shine',
    confirm: 'Conferma',
    cancel: 'Annulla',
    save: 'Salva',
    delete: 'Elimina',
    retry: 'Riprova',
    expand: 'Espandi',
    close: 'Chiudi',
    loading: 'Caricamento…',
    no_data: 'Nessun dato disponibile',

    // ── Formattazione durata ──
    duration_hours_minutes: '{{hours}}h {{mins}}m',
    duration_minutes: '{{mins}}m',
    duration_label: 'Durata {{duration}}',
    elapsed_label: 'Trascorso {{duration}}',

    // ── Intestazione ──
    header_login: 'Accedi / Registrati',
    header_confirm_logout: 'Sei sicuro di voler uscire?',

    // ── Navigazione inferiore ──
    nav_record: 'Registro',
    nav_todo: 'Attività',
    nav_report: 'Rapporto',

    // ── Chat / Pagina Registro ──
    chat_title: 'Registro',
    chat_ongoing: 'In corso',
    chat_current_activity: 'In corso: ',
    chat_placeholder_mood: 'Registra il tuo umore (es. entusiasta)… Tocca ❤️ per passare alle attività',
    chat_placeholder_activity: 'Registra la tua attività (es. pranzo)… Tocca ❤️ per passare all\'umore',
    chat_switch_to_activity: 'Passa alla modalità attività',
    chat_switch_to_mood: 'Passa alla modalità umore',
    chat_confirm_delete: 'Sei sicuro di voler eliminare questo record?',
    chat_edit_record: 'Modifica Record',
    chat_insert_record: 'Inserisci Record',
    chat_label_content: 'Contenuto',
    chat_placeholder_content: 'Cosa hai fatto…',
    chat_label_start_time: 'Ora di inizio',
    chat_label_end_time: 'Ora di fine',
    chat_title_edit: 'Modifica',
    chat_title_insert: 'Inserisci dopo',
    chat_title_delete: 'Elimina',

    // ── Pagina Attività ──
    todo_title: 'Attività',
    todo_filter_daily: 'Oggi',
    todo_filter_weekly: 'Questa settimana',
    todo_filter_monthly: 'Questo mese',
    todo_empty: 'Nessuna attività',
    todo_add: 'Aggiungi attività',
    todo_edit: 'Modifica attività',
    todo_label_content: 'Contenuto',
    todo_placeholder_content: 'Cosa fare…',
    todo_label_priority: 'Priorità',
    todo_label_recurrence: 'Ripetizione',
    todo_label_category: 'Categoria',
    todo_placeholder_custom_category: 'Personalizzato…',
    todo_delete_confirm: 'Elimina questa attività',
    todo_duration: 'Durata {{minutes}} min',
    todo_pin: 'Fissa in alto',
    todo_unpin: 'Rimuovi',
    todo_start: 'Avvia timer',
    todo_in_progress: 'In corso',

    // Etichette priorità
    priority_urgent_important: 'Urgente e Importante',
    priority_important_not_urgent: 'Importante, Non Urgente',
    priority_urgent_not_important: 'Urgente, Non Importante',
    priority_not_important_not_urgent: 'Non Importante, Non Urgente',

    // Etichette ricorrenza
    recurrence_none: 'Nessuna ripetizione',
    recurrence_daily: 'Ogni giorno',
    recurrence_weekly: 'Ogni settimana',
    recurrence_monthly: 'Ogni mese',

    // ── Pagina Rapporto ──
    report_title: 'Rapporto Temporale',
    report_calendar_view: 'Vista Calendario',
    report_weekly: 'Settimanale',
    report_monthly: 'Mensile',
    report_custom: 'Rapporto Personalizzato',
    report_completed: 'Completati',
    report_total_tasks: 'Totale Attività',
    report_completion_rate: 'Tasso di Completamento',
    report_habit_tracking: 'Abitudini',
    report_checked: 'Fatto',
    report_unchecked: 'Da fare',
    report_quadrant_distribution: 'Quadrante Priorità',
    report_completion_trend: 'Trend di Completamento',
    report_activity_records: 'Registro Attività',
    report_observer_analysis: 'Analisi dell\'Osservatore',
    report_observer_waiting: 'L\'osservatore del Prisma del Tempo è in attesa dei tuoi record…',
    report_generate_diary: 'Visualizza l\'Osservazione di Oggi',
    report_generate_confirm: 'Puoi generare un\'osservazione solo una volta al giorno. Generarla ora?',
    report_generating: 'L\'osservatore sta raccogliendo i frammenti temporali di oggi…',
    report_generating_patience: 'La consegna degli appunti attraverso anni luce richiede tempo — attendi 1‑2 minuti',
    report_from_prism: 'Osservazione dal Prisma del Tempo',
    report_coming_soon: 'In arrivo',
    report_weekly_coming_soon: 'Il rapporto settimanale è in viaggio interstellare — arriverà presto…',
    report_monthly_coming_soon: 'Il rapporto mensile si sta calibrando nella dimensione temporale — presto disponibile…',
    report_custom_coming_soon: 'Il rapporto personalizzato sta assemblando i suoi componenti — sarà lanciato a breve…',
    report_completed_tasks: 'Attività Completate',
    report_all_tasks: 'Tutte le Attività',
    report_no_tasks: 'Nessuna attività',

    // ── Pagina Autenticazione ──
    auth_welcome_back: 'Bentornato',
    auth_create_account: 'Crea Account',
    auth_login_subtitle: 'Accedi per sincronizzare i tuoi dati',
    auth_register_subtitle: 'Registrati per iniziare la sincronizzazione cloud',
    auth_account_label: 'Indirizzo email',
    auth_account_placeholder: 'Indirizzo email',
    auth_nickname_label: 'Nickname',
    auth_nickname_placeholder: 'Il tuo nickname (opzionale)',
    auth_password_label: 'Password',
    auth_password_placeholder: 'Password',
    auth_login_button: 'Accedi',
    auth_register_button: 'Registrati',
    auth_switch_to_register: 'Non hai un account? Registrati',
    auth_switch_to_login: 'Hai già un account? Accedi',
    auth_register_success: 'Registrazione avvenuta! Controlla la tua email per confermare l\'account, poi accedi.',
    auth_error_rate_limit: 'Troppe richieste — riprova più tardi (limite email raggiunto)',
    auth_error_invalid_credentials: 'Email o password non valide',
    auth_error_user_exists: 'Questa email è già registrata',
    auth_error_password_short: 'La password deve essere di almeno 6 caratteri',
    auth_error_invalid_grant: 'Informazioni di accesso non valide o scadute',
    auth_error_generic: 'Si è verificato un errore: ',

    // ── Bolla Annotazione AI ──
    annotation_condensing: 'Cristallizzando…',
    annotation_condense: 'Cristallizza',
    annotation_condensed: 'Cristallizzato',
    annotation_hover_pause: 'In pausa al passaggio del mouse',

    // ── Scheda Stardust ──
    stardust_loading: 'Recupero memoria…',
    stardust_error_default: 'Caricamento memoria fallito — riprova più tardi',
    stardust_from: 'Da {{name}} · {{date}}',

    // ── Categorie Attività ──
    category_study: 'Studio',
    category_work: 'Lavoro',
    category_social: 'Sociale',
    category_life: 'Vita',
    category_entertainment: 'Intrattenimento',

    // ── Selettore Lingua ──
    language_switch: 'Lingua',
    language_en: 'EN',
    language_zh: '中',

    // ── Riepilogo di ieri (Nuovo giorno) ──
    yesterday_summary: 'Ieri hai registrato {{count}} attività',
    yesterday_last_activity: 'Ultima attività: {{content}}',
    yesterday_tap_to_view: 'Tocca o scorri verso l\'alto per vedere i record di ieri',
    new_day_start: 'Inizia la tua giornata con un nuovo record',
    record_what_you_do: 'Registra ciò che stai facendo',
};

export default it;
