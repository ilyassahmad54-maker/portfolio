import { PortfolioData } from '@/types/portfolio';
import publishedData from '@/data.json';

// Edit Mode exports are prepared into data.json and public/assets before deployment.
export const portfolioData = publishedData as PortfolioData;
