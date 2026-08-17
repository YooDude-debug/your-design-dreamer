/** Zentrale Unternehmensdaten – hier ändern, damit alle Stellen konsistent bleiben. */
export const COMPANY = {
  name: "Y-Dude UG i.G.",
  street: "Wuhlestraße 7a",
  city: "12683 Berlin",
  country: "Deutschland",
  email: "Tidymagic@gmail.com",
} as const;

/** Einzeiler: "Y-Dude UG i.G., Wuhlestraße 7a, 12683 Berlin, Deutschland" */
export const COMPANY_ADDRESS_LINE = `${COMPANY.name}, ${COMPANY.street}, ${COMPANY.city}, ${COMPANY.country}`;
