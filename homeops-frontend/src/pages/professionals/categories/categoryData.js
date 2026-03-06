/**
 * Hierarchical category data for the Professionals Directory.
 *
 * Each parent category contains child categories (subcategories).
 * The flat CATEGORIES array is derived from the hierarchy so both
 * tree and table views can consume the same source of truth.
 */

function imageSeed(id) {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000;
}

const CATEGORY_HIERARCHY = [
  {
    id: "outdoor-garden",
    name: "Outdoor & Garden",
    description: "Professionals specializing in outdoor spaces, landscaping, and exterior structures",
    icon: "leaf",
    children: [
      {
        id: "landscapers",
        name: "Landscapers",
        description: "Garden design, lawn care, and hardscaping",
        proCount: 167,
        imageUrl: `https://picsum.photos/seed/${imageSeed("landscapers")}/400/280`,
      },
      {
        id: "roofers",
        name: "Roofers",
        description: "Roof repair, replacement, and inspection",
        proCount: 74,
        imageUrl: `https://picsum.photos/seed/${imageSeed("roofers")}/400/280`,
      },
      {
        id: "fencing",
        name: "Fencing Contractors",
        description: "Fence installation, repair, and staining",
        proCount: 52,
        imageUrl: `https://picsum.photos/seed/${imageSeed("fencing")}/400/280`,
      },
      {
        id: "pool-spa",
        name: "Pool & Spa",
        description: "Pool construction, maintenance, and spa services",
        proCount: 41,
        imageUrl: `https://picsum.photos/seed/${imageSeed("pool-spa")}/400/280`,
      },
      {
        id: "tree-service",
        name: "Tree Service",
        description: "Tree trimming, removal, and stump grinding",
        proCount: 63,
        imageUrl: `https://picsum.photos/seed/${imageSeed("tree-service")}/400/280`,
      },
    ],
  },
  {
    id: "hvac-electric",
    name: "HVAC & Electrical",
    description: "Heating, cooling, ventilation, and electrical system professionals",
    icon: "zap",
    children: [
      {
        id: "hvac",
        name: "HVAC Specialists",
        description: "Heating, cooling, and ventilation systems",
        proCount: 91,
        imageUrl: `https://picsum.photos/seed/${imageSeed("hvac")}/400/280`,
      },
      {
        id: "electricians",
        name: "Electricians",
        description: "Wiring, panel upgrades, and lighting",
        proCount: 89,
        imageUrl: `https://picsum.photos/seed/${imageSeed("electricians")}/400/280`,
      },
      {
        id: "solar",
        name: "Solar Installers",
        description: "Solar panel installation and maintenance",
        proCount: 37,
        imageUrl: `https://picsum.photos/seed/${imageSeed("solar")}/400/280`,
      },
      {
        id: "generators",
        name: "Generator Services",
        description: "Standby and portable generator installation",
        proCount: 28,
        imageUrl: `https://picsum.photos/seed/${imageSeed("generators")}/400/280`,
      },
    ],
  },
  {
    id: "kitchen-bath",
    name: "Kitchen & Bath",
    description: "Renovation and remodeling specialists for kitchens and bathrooms",
    icon: "droplets",
    children: [
      {
        id: "kitchen-bath-remodelers",
        name: "Kitchen & Bath Remodelers",
        description: "Complete kitchen and bathroom renovation",
        proCount: 183,
        imageUrl: `https://picsum.photos/seed/${imageSeed("kitchen-bath-remodelers")}/400/280`,
      },
      {
        id: "cabinets",
        name: "Cabinets & Cabinetry",
        description: "Custom cabinets, refacing, and installation",
        proCount: 127,
        imageUrl: `https://picsum.photos/seed/${imageSeed("cabinets")}/400/280`,
      },
      {
        id: "plumbers",
        name: "Plumbers",
        description: "Repairs, installations, and pipe work",
        proCount: 112,
        imageUrl: `https://picsum.photos/seed/${imageSeed("plumbers")}/400/280`,
      },
      {
        id: "countertops",
        name: "Countertop Installers",
        description: "Granite, quartz, and solid surface countertops",
        proCount: 68,
        imageUrl: `https://picsum.photos/seed/${imageSeed("countertops")}/400/280`,
      },
      {
        id: "tile",
        name: "Tile Installers",
        description: "Floor and wall tile installation and repair",
        proCount: 94,
        imageUrl: `https://picsum.photos/seed/${imageSeed("tile")}/400/280`,
      },
    ],
  },
  {
    id: "home-design",
    name: "Home Design & Remodeling",
    description: "Architecture, design, and full-service remodeling professionals",
    icon: "palette",
    children: [
      {
        id: "architects",
        name: "Architects",
        description: "Residential and commercial architecture",
        proCount: 68,
        imageUrl: `https://picsum.photos/seed/${imageSeed("architects")}/400/280`,
      },
      {
        id: "interior-designers",
        name: "Interior Designers",
        description: "Space planning, decoration, and styling",
        proCount: 156,
        imageUrl: `https://picsum.photos/seed/${imageSeed("interior-designers")}/400/280`,
      },
      {
        id: "general-contractors",
        name: "General Contractors",
        description: "Full-service remodeling and construction",
        proCount: 214,
        imageUrl: `https://picsum.photos/seed/${imageSeed("general-contractors")}/400/280`,
      },
      {
        id: "hardwood-flooring",
        name: "Hardwood Flooring",
        description: "Installation, refinishing, and repair",
        proCount: 98,
        imageUrl: `https://picsum.photos/seed/${imageSeed("hardwood-flooring")}/400/280`,
      },
      {
        id: "painters",
        name: "Painters",
        description: "Interior and exterior painting services",
        proCount: 143,
        imageUrl: `https://picsum.photos/seed/${imageSeed("painters")}/400/280`,
      },
    ],
  },
  {
    id: "plumbing-water",
    name: "Plumbing & Water Systems",
    description: "Water supply, drainage, and water treatment professionals",
    icon: "droplet",
    children: [
      {
        id: "well-pump",
        name: "Well & Pump Services",
        description: "Well drilling, pump repair, and water testing",
        proCount: 31,
        imageUrl: `https://picsum.photos/seed/${imageSeed("well-pump")}/400/280`,
      },
      {
        id: "water-treatment",
        name: "Water Treatment",
        description: "Water softeners, filtration, and purification",
        proCount: 44,
        imageUrl: `https://picsum.photos/seed/${imageSeed("water-treatment")}/400/280`,
      },
      {
        id: "septic",
        name: "Septic Services",
        description: "Septic tank installation, pumping, and repair",
        proCount: 39,
        imageUrl: `https://picsum.photos/seed/${imageSeed("septic")}/400/280`,
      },
    ],
  },
  {
    id: "security-tech",
    name: "Security & Technology",
    description: "Home security, smart home, and technology installation",
    icon: "shield",
    children: [
      {
        id: "security-systems",
        name: "Security Systems",
        description: "Alarm systems, cameras, and monitoring",
        proCount: 56,
        imageUrl: `https://picsum.photos/seed/${imageSeed("security-systems")}/400/280`,
      },
      {
        id: "smart-home",
        name: "Smart Home Installers",
        description: "Home automation, smart wiring, and integration",
        proCount: 43,
        imageUrl: `https://picsum.photos/seed/${imageSeed("smart-home")}/400/280`,
      },
      {
        id: "low-voltage",
        name: "Low Voltage Wiring",
        description: "Network, audio/video, and communication cabling",
        proCount: 35,
        imageUrl: `https://picsum.photos/seed/${imageSeed("low-voltage")}/400/280`,
      },
    ],
  },
  {
    id: "cleaning-maintenance",
    name: "Cleaning & Maintenance",
    description: "Recurring and deep-clean services for residential properties",
    icon: "sparkles",
    children: [
      {
        id: "house-cleaning",
        name: "House Cleaning",
        description: "Recurring, deep clean, and move-in/out cleaning",
        proCount: 201,
        imageUrl: `https://picsum.photos/seed/${imageSeed("house-cleaning")}/400/280`,
      },
      {
        id: "carpet-cleaning",
        name: "Carpet & Upholstery Cleaning",
        description: "Steam cleaning, stain removal, and restoration",
        proCount: 87,
        imageUrl: `https://picsum.photos/seed/${imageSeed("carpet-cleaning")}/400/280`,
      },
      {
        id: "window-cleaning",
        name: "Window Cleaning",
        description: "Interior and exterior window washing",
        proCount: 62,
        imageUrl: `https://picsum.photos/seed/${imageSeed("window-cleaning")}/400/280`,
      },
      {
        id: "pest-control",
        name: "Pest Control",
        description: "Insect, rodent, and wildlife management",
        proCount: 78,
        imageUrl: `https://picsum.photos/seed/${imageSeed("pest-control")}/400/280`,
      },
    ],
  },
];

/**
 * Flatten the hierarchy into a table-friendly array.
 * Each row has: id, name, description, parentId, parentName, type, proCount, childCount
 */
function flattenCategories(hierarchy) {
  const rows = [];
  for (const parent of hierarchy) {
    const childCount = parent.children?.length ?? 0;
    const totalPros = (parent.children ?? []).reduce(
      (sum, c) => sum + (c.proCount ?? 0),
      0,
    );
    rows.push({
      id: parent.id,
      name: parent.name,
      description: parent.description,
      icon: parent.icon,
      imageUrl: parent.imageUrl || null,
      parentId: null,
      parentName: null,
      type: "parent",
      proCount: totalPros,
      childCount,
    });
    for (const child of parent.children ?? []) {
      rows.push({
        id: child.id,
        name: child.name,
        description: child.description,
        imageUrl: child.imageUrl || null,
        parentId: parent.id,
        parentName: parent.name,
        type: "child",
        proCount: child.proCount ?? 0,
        childCount: 0,
      });
    }
  }
  return rows;
}

export const CATEGORIES_FLAT = flattenCategories(CATEGORY_HIERARCHY);
export {CATEGORY_HIERARCHY};
export default CATEGORY_HIERARCHY;
