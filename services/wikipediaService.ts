
import { WikipediaArticle, Coordinates } from '../types';

const BASE_URL = 'https://en.wikipedia.org/w/api.php';

export const fetchArticlesNear = async (
  lat: number,
  lng: number,
  radius: number
): Promise<WikipediaArticle[]> => {
  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${lat}|${lng}`,
    gsradius: radius.toString(),
    gslimit: '50',
    format: 'json',
    origin: '*',
  });

  const response = await fetch(`${BASE_URL}?${params}`);
  const data = await response.json();
  
  if (!data.query || !data.query.geosearch) return [];

  const basicArticles: WikipediaArticle[] = data.query.geosearch;

  // Fetch more details (extracts, wordcount) for these articles
  const pageIds = basicArticles.map(a => a.pageid).join('|');
  const detailsParams = new URLSearchParams({
    action: 'query',
    pageids: pageIds,
    prop: 'extracts|revisions',
    explaintext: '1',
    exintro: '1',
    rvprop: 'timestamp|user|comment',
    format: 'json',
    origin: '*',
  });

  const detailsResponse = await fetch(`${BASE_URL}?${detailsParams}`);
  const detailsData = await detailsResponse.json();
  const pages = detailsData.query?.pages || {};

  return basicArticles.map(article => {
    const details = pages[article.pageid] || {};
    const extract = details.extract || "";
    // Calculate bearing
    const bearing = calculateBearing(lat, lng, article.lat, article.lon);
    
    return {
      ...article,
      extract,
      wordcount: extract.split(/\s+/).length,
      bearing
    };
  });
};

const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
};
