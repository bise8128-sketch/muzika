const translations = {
    bs: {
        'Missing url parameter': 'Nedostaje parametar url',
        'Invalid URL. Only GitHub URLs are allowed.': 'Nevažeći URL. Dozvoljeni su samo GitHub URL-ovi.',
        'Failed to fetch model: %s': 'Neuspjelo preuzimanje modela: %s',
        'Internal server error': 'Interna greška servera',
        'connected': 'povezano',
        'error: %s': 'greška: %s',
    },
};

export function translate(key: string, lang: string = 'bs'): string {
    const langTranslations = translations[lang as keyof typeof translations];
    if (langTranslations && langTranslations[key as keyof typeof langTranslations]) {
        return langTranslations[key as keyof typeof langTranslations] as string;
    }
    return key; // fallback to original
}