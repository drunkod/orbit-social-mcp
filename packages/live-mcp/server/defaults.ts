export const AURORA_SOURCE = `export default {
  id: "aurora",
  name: "Aurora Mode",
  theme: {
    accent: "#7058ed",
    accentSoft: "#efebff",
    appBackground: "#eeeafa",
    cardBackground: "#ffffff",
    radius: "24px"
  },
  banner: {
    eyebrow: "A NEW KIND OF SOCIAL",
    title: "Ideas look better together.",
    description: "A brighter, more expressive space — installed live through MCP.",
    emoji: "✦"
  },
  widget: {
    icon: "✷",
    title: "Creative pulse",
    value: "Trending now",
    subtitle: "4 ideas flowing in #general"
  },
  messageDecorator(message) {
    const words = /design|idea|ship|build|launch/i;
    return words.test(message.text)
      ? { tag: "SPARK", highlight: true, tint: "#f2eaff" }
      : {};
  }
};
`;

export const FOCUS_SOURCE = `export default {
  id: "focus",
  name: "Focus Flow",
  theme: {
    accent: "#0b8f80",
    accentSoft: "#d9f5ed",
    appBackground: "#eaf4f0",
    cardBackground: "#ffffff",
    radius: "14px"
  },
  banner: {
    eyebrow: "DISTRACTION-FREE MODE",
    title: "Make room for meaningful conversations.",
    description: "Reduce noise. Focus on your people and the ideas that matter.",
    emoji: "◉"
  },
  widget: {
    icon: "◈",
    title: "Focus session",
    value: "You're in flow",
    subtitle: "A quieter way to stay connected"
  },
  hideReactions: true,
  compactMessages: true,
  composerPlaceholder: "Write a thoughtful message...",
  messageDecorator(message) {
    return /focus|plan|quiet|ship/i.test(message.text)
      ? { tag: "IN FOCUS", highlight: true, tint: "#ddf4ed" }
      : {};
  }
};
`;

export const DEFAULT_MESSAGES = [
  { id: "m1", author: "Maya Chen", initials: "MC", tone: "coral", time: "10:24 AM", text: "Morning, everyone! ☀️ Just shared the first look at our new community space. What do you think?", reactions: ["💜 12", "🔥 4"] },
  { id: "m2", author: "Alex Rivera", initials: "AR", tone: "blue", time: "10:27 AM", text: "The design is looking so good. Love how we can shape the experience together.", reactions: ["✨ 8"] },
  { id: "m3", author: "Jordan Lee", initials: "JL", tone: "violet", time: "10:31 AM", text: "Imagine if an AI could install a plugin and transform this whole interface while we're chatting 👀", reactions: ["🚀 16", "🤯 6"] },
  { id: "m4", author: "Sam Taylor", initials: "ST", tone: "green", time: "10:38 AM", text: "Let's ship it! One MCP connection, endless ways to make the space our own.", reactions: ["💜 9"] }
];
