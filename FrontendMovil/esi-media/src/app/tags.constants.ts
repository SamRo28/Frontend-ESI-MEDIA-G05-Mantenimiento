export const TAGS_VIDEO = [
    'Acción',
    'Comedia',
    'Drama',
    'Suspenso',
    'Animación',
    'Ciencia Ficción',
    'Terror',
    'Documental',
    'Romance',
    'Aventura'
];

export const TAGS_AUDIO = [
    'Comedia',
    'Podcast',
    'Humor',
    'Música',
    'Entrevista',
    'Relajación',
    'Educativo',
    'Narrativa',
    'Motivacional',
    'Noticias'
];

export const TAGS_ALL = Array.from(new Set([...TAGS_VIDEO, ...TAGS_AUDIO]));
