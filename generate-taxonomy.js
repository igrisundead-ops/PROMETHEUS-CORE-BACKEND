const fs = require('fs');

const graph = JSON.parse(fs.readFileSync('font-intelligence/outputs/font-compatibility-graph.json', 'utf8'));

const nodes = graph.nodes;

const taxonomy = [];

const cleanFamily = (family) => family.trim();

const isScriptOrDecorative = (node) => {
    const roles = node.roles || [];
    const traits = node.personality || [];
    const name = (node.family + " " + node.style).toLowerCase();
    
    return roles.includes('script') || roles.includes('decorative') || 
           traits.includes('elegant') || traits.includes('handwriting') ||
           name.includes('script') || name.includes('signature') || name.includes('brush') ||
           name.includes('aesthetic') || name.includes('ramashinta');
};

const isImpact = (node) => {
    const weight = node.metadata.observed.weightClass || 400;
    const traits = node.personality || [];
    const roles = node.roles || [];
    
    return weight >= 700 && (roles.includes('display') || roles.includes('headline') || traits.includes('bold') || traits.includes('impact'));
};

const isEditorial = (node) => {
    const traits = node.personality || [];
    const roles = node.roles || [];
    // Looking for premium serif cues
    return roles.includes('display') && (traits.includes('premium') || traits.includes('luxury') || traits.includes('serif'));
};

nodes.forEach(node => {
    const family = cleanFamily(node.family);
    const weight = node.metadata.observed.weightClass || 400;
    const roles = node.roles || [];
    
    let bucket = "neutral_reading"; // default
    
    if (isScriptOrDecorative(node)) {
        bucket = "accent_script_or_italic";
    } else if (isImpact(node)) {
        bucket = "hero_impact";
    } else if (isEditorial(node)) {
        bucket = "editorial_authority";
    } else if (roles.includes("display") && weight >= 600) {
        bucket = "kinetic_display";
    }
    
    // Simplistic bad spacing / poor coverage filter for forbidden
    const glyphCount = node.metadata.observed.glyphCount || 0;
    if (glyphCount < 100) {
        bucket = "forbidden_or_manual_review";
    }

    taxonomy.push({
        fontId: node.id,
        family: family,
        postscriptName: node.metadata.observed.postscriptName,
        availableWeights: [weight],
        roleBuckets: [bucket],
        confidence: "high",
        reasons: [`Glyphs: ${glyphCount}, Weight: ${weight}`],
        restrictions: []
    });
});

fs.writeFileSync('font-role-taxonomy.json', JSON.stringify(taxonomy, null, 2));
console.log("Taxonomy generated with " + taxonomy.length + " fonts.");
