export type PublishingConfig = {
  publication: {
    enabled: boolean;
    tokenRequired: number;
    label: string;
    blocking: boolean;
    rules: {
      allowWithoutTokens: boolean;
      redirectIfInsufficient: boolean;
    };
  };
  promote: {
    extended: {
      type: "duration";
      stackable: boolean;
      paymentMode: Array<"tokens" | "money">;
      options: Array<{ id: number; days: number; tokens: number; price: number }>;
    };
    featured: {
      type: "visibility";
      badge: "PREMIUM";
      color: "green";
      stackable: boolean;
      paymentMode: Array<"tokens">;
      options: Array<{ id: number; days: number; tokens: number }>;
    };
    autorenew: {
      type: "boost";
      badge: "TOP";
      stackable: boolean;
      paymentMode: Array<"tokens">;
      options: Array<{ id: number; everyHours: number; days: number; tokens: number }>;
    };
    urgent: {
      type: "label";
      badge: "URGENT";
      color: "red";
      stackable: boolean;
      paymentMode: Array<"tokens">;
      options: Array<{ id: number; days: number; tokens: number }>;
    };
  };
  // Backend-only rules can exist here; the API may choose not to expose them fully.
  rules: {
    vip: {
      definition: Array<"featured" | "autorenew">;
      discountTokens: number;
    };
    stacking: {
      allowMultipleOptions: boolean;
      maxTotalTokens: number;
    };
    security: {
      frontendCalculation: boolean;
      backendValidation: boolean;
    };
  };
};

export const PUBLISHING_CONFIG: PublishingConfig = {
  publication: {
    enabled: true,
    tokenRequired: 1,
    label: "Publication standard",
    blocking: true,
    rules: {
      allowWithoutTokens: false,
      redirectIfInsufficient: true,
    },
  },
  promote: {
    extended: {
      type: "duration",
      stackable: false,
      // Money-mode requires a payment integration for "promote" (not implemented yet).
      // For now, keep publication/boost purely token-based to avoid free prolongation.
      paymentMode: ["tokens"],
      options: [
        { id: 1, days: 45, tokens: 1, price: 4600 },
        { id: 2, days: 90, tokens: 2, price: 7900 },
        { id: 3, days: 180, tokens: 3, price: 12500 },
        { id: 4, days: 365, tokens: 5, price: 23100 },
      ],
    },
    featured: {
      type: "visibility",
      badge: "PREMIUM",
      color: "green",
      stackable: false,
      paymentMode: ["tokens"],
      options: [
        { id: 1, days: 3, tokens: 1 },
        { id: 2, days: 7, tokens: 2 },
        { id: 3, days: 15, tokens: 3 },
        { id: 4, days: 30, tokens: 4 },
        { id: 5, days: 45, tokens: 5 },
        { id: 6, days: 60, tokens: 6 },
        { id: 7, days: 90, tokens: 7 },
      ],
    },
    autorenew: {
      type: "boost",
      badge: "TOP",
      stackable: false,
      paymentMode: ["tokens"],
      options: [
        { id: 1, everyHours: 1, days: 3, tokens: 2 },
        { id: 2, everyHours: 1, days: 7, tokens: 4 },
        { id: 3, everyHours: 1, days: 15, tokens: 6 },
        { id: 4, everyHours: 1, days: 30, tokens: 7 },
        { id: 5, everyHours: 4, days: 30, tokens: 5 },
        { id: 6, everyHours: 3, days: 30, tokens: 6 },
        { id: 7, everyHours: 2, days: 30, tokens: 6 },
      ],
    },
    urgent: {
      type: "label",
      badge: "URGENT",
      color: "red",
      stackable: false,
      paymentMode: ["tokens"],
      options: [
        { id: 2, days: 7, tokens: 1 },
        { id: 3, days: 15, tokens: 2 },
        { id: 4, days: 30, tokens: 3 },
      ],
    },
  },
  rules: {
    vip: {
      definition: ["featured", "autorenew"],
      discountTokens: 1,
    },
    stacking: {
      allowMultipleOptions: true,
      maxTotalTokens: 20,
    },
    security: {
      frontendCalculation: false,
      backendValidation: true,
    },
  },
};




