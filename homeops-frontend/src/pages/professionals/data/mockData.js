// Seed for picsum: numeric from string id for consistent service-style images
function imageSeed(id) {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000;
}

export const SERVICE_CATEGORIES = [
  {
    id: "cabinets",
    name: "Cabinets & Cabinetry",
    icon: "cabinet",
    description: "Custom cabinets, refacing, and installation",
    proCount: 127,
    imageUrl: `https://picsum.photos/seed/${imageSeed("cabinets")}/400/280`,
  },
  {
    id: "hardwood-flooring",
    name: "Hardwood Flooring",
    icon: "flooring",
    description: "Installation, refinishing, and repair",
    proCount: 98,
    imageUrl: `https://picsum.photos/seed/${imageSeed("hardwood-flooring")}/400/280`,
  },
  {
    id: "general-contractors",
    name: "General Contractors",
    icon: "contractor",
    description: "Full-service remodeling and construction",
    proCount: 214,
    imageUrl: `https://picsum.photos/seed/${imageSeed("general-contractors")}/400/280`,
  },
  {
    id: "interior-designers",
    name: "Interior Designers",
    icon: "design",
    description: "Space planning, decoration, and styling",
    proCount: 156,
    imageUrl: `https://picsum.photos/seed/${imageSeed("interior-designers")}/400/280`,
  },
  {
    id: "electricians",
    name: "Electricians",
    icon: "electric",
    description: "Wiring, panel upgrades, and lighting",
    proCount: 89,
    imageUrl: `https://picsum.photos/seed/${imageSeed("electricians")}/400/280`,
  },
  {
    id: "plumbers",
    name: "Plumbers",
    icon: "plumbing",
    description: "Repairs, installations, and pipe work",
    proCount: 112,
    imageUrl: `https://picsum.photos/seed/${imageSeed("plumbers")}/400/280`,
  },
  {
    id: "painters",
    name: "Painters",
    icon: "paint",
    description: "Interior and exterior painting services",
    proCount: 143,
    imageUrl: `https://picsum.photos/seed/${imageSeed("painters")}/400/280`,
  },
  {
    id: "landscapers",
    name: "Landscapers",
    icon: "landscape",
    description: "Garden design, lawn care, and hardscaping",
    proCount: 167,
    imageUrl: `https://picsum.photos/seed/${imageSeed("landscapers")}/400/280`,
  },
  {
    id: "roofers",
    name: "Roofers",
    icon: "roof",
    description: "Roof repair, replacement, and inspection",
    proCount: 74,
    imageUrl: `https://picsum.photos/seed/${imageSeed("roofers")}/400/280`,
  },
  {
    id: "hvac",
    name: "HVAC Specialists",
    icon: "hvac",
    description: "Heating, cooling, and ventilation systems",
    proCount: 91,
    imageUrl: `https://picsum.photos/seed/${imageSeed("hvac")}/400/280`,
  },
  {
    id: "kitchen-bath",
    name: "Kitchen & Bath Remodelers",
    icon: "kitchen",
    description: "Complete kitchen and bathroom renovation",
    proCount: 183,
    imageUrl: `https://picsum.photos/seed/${imageSeed("kitchen-bath")}/400/280`,
  },
  {
    id: "architects",
    name: "Architects",
    icon: "architect",
    description: "Residential and commercial architecture",
    proCount: 68,
    imageUrl: `https://picsum.photos/seed/${imageSeed("architects")}/400/280`,
  },
];

/** Grouped sections for the directory (Houzz-style). */
export const CATEGORY_SECTIONS = [
  {
    id: "outdoor",
    title: "Outdoor & Garden",
    categoryIds: ["landscapers", "roofers"],
  },
  {
    id: "hvac-electric",
    title: "HVAC & Electric",
    categoryIds: ["hvac", "electricians"],
  },
  {
    id: "kitchen-bath",
    title: "Kitchen & Bath",
    categoryIds: ["kitchen-bath", "cabinets", "plumbers"],
  },
  {
    id: "home-design",
    title: "Home Design & Remodeling",
    categoryIds: [
      "architects",
      "interior-designers",
      "general-contractors",
      "hardwood-flooring",
      "painters",
    ],
  },
];

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "Portuguese",
  "Mandarin",
  "Korean",
  "Vietnamese",
  "Arabic",
  "Russian",
  "Italian",
];

export const MOCK_LOCATIONS = [
  { label: "Miami, FL 33101", city: "Miami", state: "FL", zip: "33101" },
  { label: "Miami Beach, FL 33139", city: "Miami Beach", state: "FL", zip: "33139" },
  { label: "Fort Lauderdale, FL 33301", city: "Fort Lauderdale", state: "FL", zip: "33301" },
  { label: "Orlando, FL 32801", city: "Orlando", state: "FL", zip: "32801" },
  { label: "Tampa, FL 33602", city: "Tampa", state: "FL", zip: "33602" },
  { label: "Jacksonville, FL 32099", city: "Jacksonville", state: "FL", zip: "32099" },
  { label: "New York, NY 10001", city: "New York", state: "NY", zip: "10001" },
  { label: "Los Angeles, CA 90001", city: "Los Angeles", state: "CA", zip: "90001" },
  { label: "Chicago, IL 60601", city: "Chicago", state: "IL", zip: "60601" },
  { label: "Houston, TX 77001", city: "Houston", state: "TX", zip: "77001" },
  { label: "Dallas, TX 75201", city: "Dallas", state: "TX", zip: "75201" },
  { label: "Austin, TX 73301", city: "Austin", state: "TX", zip: "73301" },
  { label: "Atlanta, GA 30301", city: "Atlanta", state: "GA", zip: "30301" },
  { label: "Denver, CO 80201", city: "Denver", state: "CO", zip: "80201" },
  { label: "Seattle, WA 98101", city: "Seattle", state: "WA", zip: "98101" },
];

const FIRST_NAMES = [
  "James", "Maria", "Robert", "Sarah", "David", "Elena", "Michael",
  "Ana", "Carlos", "Jennifer", "William", "Sofia", "Daniel", "Laura",
  "Thomas", "Isabella", "Richard", "Camila", "Mark", "Emily",
];

const LAST_NAMES = [
  "Anderson", "Martinez", "Williams", "Garcia", "Johnson", "Rodriguez",
  "Brown", "Lopez", "Wilson", "Hernandez", "Taylor", "Gonzalez",
  "Moore", "Perez", "Clark", "Ramirez", "Lewis", "Torres", "Lee", "Nguyen",
];

const COMPANY_SUFFIXES = [
  "& Sons", "Group", "Services", "Solutions", "Co.", "Pros",
  "Design", "Contracting", "Specialists", "Studio",
];

const DESCRIPTIONS = [
  "Award-winning professional with over {years} years of experience delivering exceptional results for residential and commercial clients.",
  "Specializing in high-end residential projects. Known for meticulous attention to detail and client-first approach.",
  "Full-service provider offering comprehensive solutions from design to completion. Licensed and insured.",
  "Family-owned business serving the local community for over {years} years. Free consultations available.",
  "Trusted by homeowners and builders alike. Featured in multiple home design publications.",
  "Certified professional with expertise in both traditional and modern styles. Satisfaction guaranteed.",
  "Experienced team dedicated to quality craftsmanship and timely project completion.",
  "Eco-friendly solutions and sustainable practices. Green-certified and energy-efficient specialist.",
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateProfessionals() {
  const professionals = [];

  for (let i = 0; i < 60; i++) {
    const seed = i + 42;
    const r = (offset = 0) => seededRandom(seed + offset);

    const firstName = FIRST_NAMES[Math.floor(r(1) * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(r(2) * LAST_NAMES.length)];
    const category = SERVICE_CATEGORIES[Math.floor(r(3) * SERVICE_CATEGORIES.length)];
    const location = MOCK_LOCATIONS[Math.floor(r(4) * MOCK_LOCATIONS.length)];
    const companySuffix = COMPANY_SUFFIXES[Math.floor(r(5) * COMPANY_SUFFIXES.length)];
    const yearsInBusiness = Math.floor(r(6) * 25) + 2;
    const rating = Math.round((3.5 + r(7) * 1.5) * 10) / 10;
    const reviewCount = Math.floor(r(8) * 180) + 5;
    const descTemplate = DESCRIPTIONS[Math.floor(r(9) * DESCRIPTIONS.length)];
    const numLanguages = Math.floor(r(10) * 3) + 1;
    const langStart = Math.floor(r(11) * (LANGUAGES.length - numLanguages));
    const languages = ["English", ...LANGUAGES.slice(langStart, langStart + numLanguages - 1)];
    const uniqueLangs = [...new Set(languages)];
    const photoSeed = Math.floor(r(12) * 70) + 1;

    professionals.push({
      id: `pro-${i + 1}`,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      companyName: `${lastName} ${companySuffix}`,
      categoryId: category.id,
      categoryName: category.name,
      location,
      serviceArea: `${location.city}, ${location.state}`,
      rating,
      reviewCount,
      yearsInBusiness,
      description: descTemplate.replace("{years}", String(yearsInBusiness)),
      languages: uniqueLangs,
      phone: `(${300 + Math.floor(r(13) * 700)}) ${100 + Math.floor(r(14) * 900)}-${1000 + Math.floor(r(15) * 9000)}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      photoUrl: `https://i.pravatar.cc/150?img=${photoSeed}`,
      website: `https://www.${lastName.toLowerCase()}${companySuffix.replace(/[& .]/g, "").toLowerCase()}.com`,
      saved: i < 8,
      projectPhotos: Array.from({ length: Math.floor(r(16) * 6) + 2 }, (_, j) => ({
        id: `photo-${i}-${j}`,
        url: `https://picsum.photos/seed/${seed + j}/600/400`,
        caption: `Project ${j + 1}`,
      })),
    });
  }

  return professionals;
}

export const MOCK_PROFESSIONALS = generateProfessionals();
