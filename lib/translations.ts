export type Language = "en" | "ta";

export const languageLabels: Record<Language, string> = {
  en: "English",
  ta: "தமிழ்",
};

export type TranslationSet = {
  brand: string;
  tagline: string;
  login: string;
  subscribe: string;
  search: string;
  home: string;
  movies: string;
  categories: string;
  library: string;
  dashboard: string;
  admin: string;
  watchNow: string;
  viewDetails: string;
  continueWatching: string;
  trending: string;
  newReleases: string;
  tamilMovies: string;
  dubbedMovies: string;
  recommended: string;
  footerLegal: string;
  privacy: string;
  terms: string;
  copyright: string;
  report: string;
  social: string;
  free: string;
  premium: string;
  profile: string;
  logout: string;
  searchPlaceholder: string;
  language: string;
  discover: string;
  browse: string;
};

export const translations: Record<Language, TranslationSet> = {
  en: {
    brand: "MoviesHub",
    tagline: "Your world of Tamil cinema",
    login: "Login",
    subscribe: "Subscribe",
    search: "Search",
    home: "Home",
    movies: "Movies",
    categories: "Categories",
    library: "Library",
    dashboard: "Dashboard",
    admin: "Admin",
    watchNow: "Watch Now",
    viewDetails: "View Details",
    continueWatching: "Continue Watching",
    trending: "Trending Movies",
    newReleases: "New Releases",
    tamilMovies: "Tamil Movies",
    dubbedMovies: "Dubbed Movies",
    recommended: "Recommended For You",
    footerLegal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    copyright: "Copyright Policy",
    report: "Content Report",
    social: "Social",
    free: "Free",
    premium: "Premium",
    profile: "Profile",
    logout: "Logout",
    searchPlaceholder: "Search titles, genres, actors...",
    language: "Language",
    discover: "Discover",
    browse: "Browse",
  },
  ta: {
    brand: "மூவிஹப்",
    tagline: "உங்கள் தமிழ்சினிமா உலகம்",
    login: "உள்நுழை",
    subscribe: "சந்தா",
    search: "தேடு",
    home: "முகப்பு",
    movies: "திரைப்படங்கள்",
    categories: "வகைகள்",
    library: "நூலகம்",
    dashboard: "டாஷ்போர்டு",
    admin: "நிர்வாகம்",
    watchNow: "இப்போது பார்க்கவும்",
    viewDetails: "விவரங்களைப் பார்க்க",
    continueWatching: "தொடர்ந்து பார்க்கப்படுகிறது",
    trending: "ட்ரெண்டிங்",
    newReleases: "புதிய வெளியீடுகள்",
    tamilMovies: "தமிழ் திரைப்படங்கள்",
    dubbedMovies: "டப் செய்யப்பட்ட திரைப்படங்கள்",
    recommended: "உங்களுக்காக பரிந்துரைக்கப்படுகிறது",
    footerLegal: "சட்டம்",
    privacy: "தனியுரிமைக் கொள்கை",
    terms: "சேவை விதிமுறைகள்",
    copyright: "பதிப்புரிமை கொள்கை",
    report: "உள்ளடக்க அறிக்கை",
    social: "சமூகம்",
    free: "இலவசம்",
    premium: "பிரீமியம்",
    profile: "சுயவிவரம்",
    logout: "வெளியேறு",
    searchPlaceholder: "திரைப்படங்கள், வகைகள், நடிகர்கள்...",
    language: "மொழி",
    discover: "கண்டறியவும்",
    browse: "உலவுக",
  },
};

export const getTranslations = (language: Language) => translations[language];
