exports.handler = async (event, context) => {
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Clé API manquante' })
    };
  }

  try {
    // Étape 1 : Rechercher le lieu par texte
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.reviews'
      },
      body: JSON.stringify({
        textQuery: 'Top Carrelage 22 Avenue de l\'Europe Bailleul France',
        maxResultCount: 1,
        languageCode: 'fr'
      })
    });

    const data = await searchRes.json();

    if (!data.places || data.places.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Lieu non trouvé' })
      };
    }

    const place = data.places[0];

    // Formater et filtrer uniquement les avis 5 étoiles avec un texte
    const reviews = (place.reviews || [])
      .filter(r => r.rating === 5 && r.text?.text && r.text.text.trim().length > 20)
      .map(r => ({
        nom: r.authorAttribution?.displayName || 'Anonyme',
        avatar: r.authorAttribution?.photoUri || null,
        note: r.rating || 5,
        texte: r.text?.text || '',
        date: r.relativePublishTimeDescription || ''
      }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache 1h
      },
      body: JSON.stringify({
        note: place.rating || 0,
        totalAvis: place.userRatingCount || 0,
        reviews
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
