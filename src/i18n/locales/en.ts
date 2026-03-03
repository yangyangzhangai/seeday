const en = {
    // ── Common ──
    app_name: 'TimeShine',
    confirm: 'Save',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    retry: 'Retry',
    expand: 'Expand',
    close: 'Close',
    loading: 'Loading…',
    no_data: 'No data available',

    // ── Duration formatting ──
    duration_hours_minutes: '{{hours}}h {{mins}}m',
    duration_minutes: '{{mins}}m',
    duration_label: 'Duration {{duration}}',
    elapsed_label: 'Duration: {{duration}}',

    // ── Header ──
    header_login: 'Log in / Sign up',
    header_confirm_logout: 'Are you sure you want to log out?',

    // ── Bottom Nav ──
    nav_record: 'Track',
    nav_todo: 'Tasks',
    nav_report: 'Reports',

    // ── Chat / Record Page ──
    chat_title: 'Track',
    chat_ongoing: 'Tracking',
    chat_current_activity: 'Tracking: ',
    chat_placeholder_mood: 'Log your mood (e.g., excited)… Tap ❤️ to switch to activities',
    chat_placeholder_activity: 'Log your activity (e.g., lunch)… Tap ❤️ to switch to mood',
    chat_switch_to_activity: 'Track activities',
    chat_switch_to_mood: 'Log mood',
    chat_confirm_delete: 'Are you sure you want to delete this entry?',
    chat_edit_record: 'Edit Entry',
    chat_insert_record: 'Insert Entry',
    chat_label_content: 'Activity',
    chat_placeholder_content: 'What were you doing…',
    chat_label_start_time: 'Start Time',
    chat_label_end_time: 'End Time',
    chat_title_edit: 'Edit',
    chat_title_insert: 'Insert after',
    chat_title_delete: 'Delete',

    // ── Todo Page ──
    todo_title: 'Tasks',
    todo_filter_daily: 'Today',
    todo_filter_weekly: 'This Week',
    todo_filter_monthly: 'This Month',
    todo_empty: 'No tasks yet',
    todo_add: 'New Task',
    todo_edit: 'Edit Task',
    todo_label_content: 'Task Name',
    todo_placeholder_content: 'e.g., Read a book',
    todo_label_priority: 'Priority',
    todo_label_recurrence: 'Repeat',
    todo_label_category: 'Category',
    todo_placeholder_custom_category: 'New category…',
    todo_delete_confirm: 'Delete this task',
    todo_duration: 'Duration {{minutes}} min',
    todo_pin: 'Pin',
    todo_unpin: 'Unpin',
    todo_start: 'Start timer',
    todo_in_progress: 'In progress',

    // Priority labels
    priority_urgent_important: 'Urgent & Important',
    priority_important_not_urgent: 'Important, Not Urgent',
    priority_urgent_not_important: 'Urgent, Not Important',
    priority_not_important_not_urgent: 'Not Important, Not Urgent',

    // Recurrence labels
    recurrence_none: 'Never',
    recurrence_daily: 'Daily',
    recurrence_weekly: 'Weekly',
    recurrence_monthly: 'Monthly',

    // ── Report Page ──
    report_title: 'Reports',
    report_calendar_view: 'Calendar',
    report_weekly: 'Weekly',
    report_monthly: 'Monthly',
    report_custom: 'Custom',
    report_completed: 'Completed',
    report_total_tasks: 'Total Tasks',
    report_completion_rate: 'Completion Rate',
    report_habit_tracking: 'Habits',
    report_checked: 'Done',
    report_unchecked: 'Pending',
    report_quadrant_distribution: 'Priority Quadrant',
    report_completion_trend: 'Completion Trend',
    report_activity_records: 'Activity Records',
    report_observer_analysis: 'Observer Analysis',
    report_observer_waiting: 'The Time Prism observer is waiting for your records…',
    report_generate_diary: 'View Today\'s Observation',
    report_generate_confirm: 'You can only generate one observation per day. Generate now?',
    report_generating: 'The observer is piecing together today\'s time fragments…',
    report_generating_patience: 'Delivering notes across light‑years takes time — please wait 1‑2 minutes',
    report_from_prism: 'Observation from Time Prism',
    report_coming_soon: 'Coming Soon',
    report_weekly_coming_soon: 'The weekly report feature is on an interstellar voyage — arriving soon…',
    report_monthly_coming_soon: 'The monthly report feature is calibrating in the time dimension — stay tuned…',
    report_custom_coming_soon: 'The custom report feature is assembling its parts — launching soon…',
    report_completed_tasks: 'Completed Tasks',
    report_all_tasks: 'All Tasks',
    report_no_tasks: 'No tasks',

    // ── Auth Page ──
    auth_welcome_back: 'Welcome Back',
    auth_create_account: 'Create Account',
    auth_login_subtitle: 'Log in to sync your data',
    auth_register_subtitle: 'Sign up to start cloud sync',
    auth_account_label: 'Email or phone',
    auth_account_placeholder: 'Email or phone',
    auth_nickname_label: 'Nickname',
    auth_nickname_placeholder: 'Your nickname (optional)',
    auth_password_label: 'Password',
    auth_password_placeholder: 'Password',
    auth_login_button: 'Log in',
    auth_register_button: 'Sign up',
    auth_switch_to_register: 'Don\'t have an account? Sign up',
    auth_switch_to_login: 'Already have an account? Log in',
    auth_register_success: 'Registration successful! Please check your email to confirm your account, then log in.',
    auth_error_rate_limit: 'Too many requests — please try again later (email rate limited)',
    auth_error_invalid_credentials: 'Incorrect email or password',
    auth_error_user_exists: 'This email is already registered',
    auth_error_password_short: 'Password must be at least 6 characters',
    auth_error_invalid_grant: 'Login information is invalid or expired',
    auth_error_generic: 'An error occurred: ',

    // ── AI Annotation Bubble ──
    annotation_condensing: 'Crystallizing…',
    annotation_condense: 'Crystallize',
    annotation_condensed: 'Crystallized',
    annotation_hover_pause: 'Paused on hover',

    // ── Stardust Card ──
    stardust_loading: 'Retrieving memory…',
    stardust_error_default: 'Failed to load memory — please try again later',
    stardust_from: 'From {{name}} · {{date}}',

    // ── Todo Categories ──
    category_study: 'Study',
    category_work: 'Work',
    category_social: 'Social',
    category_life: 'Life',
    category_entertainment: 'Entertainment',

    // ── Language Switcher ──
    language_switch: 'Language',
    language_en: 'EN',
    language_zh: '中',

    // ── Yesterday Review (New Day) ──
    yesterday_summary: 'You logged {{count}} entries yesterday',
    yesterday_last_activity: 'Last activity: {{content}}',
    yesterday_tap_to_view: "Tap or swipe up to see yesterday's entries",
    new_day_start: 'Start your day with a new record',
    record_what_you_do: "Record what you're doing",
} as const;

// Key-set type: zh.ts must have the same keys, but values can be any string
export type TranslationKeys = Record<keyof typeof en, string>;
export default en;
