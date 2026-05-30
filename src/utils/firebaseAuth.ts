import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Reuse initialized firebase to prevent overlapping warnings
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/calendar");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Google Credentials");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Popup Sign in Error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Google Calendar API integration functions
export interface CalendarEventInput {
  summary: string;
  description: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
}

export async function createMovieCalendarEvent(token: string, event: CalendarEventInput) {
  // Construct a standard Google Calendar event resource
  const eventResource = {
    summary: event.summary,
    description: event.description,
    start: {
      dateTime: event.startTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    end: {
      dateTime: event.endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, // Alert via email 1 day before
        { method: "popup", minutes: 30 },     // Ring screen alert 30 mins before
      ],
    },
  };

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventResource),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Failed to add event to Google Calendar");
  }

  return response.json();
}

export async function fetchUpcomingMovieEvents(token: string) {
  const now = new Date().toISOString();
  // List upcoming movies in the primary calendar
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&orderBy=startTime&singleEvents=true&maxResults=10`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to synchronize with Google Calendar feed.");
  }

  const data = await response.json();
  return data.items || [];
}
