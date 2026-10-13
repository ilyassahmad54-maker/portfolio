import type { Metadata } from 'next';
import type { PortfolioData } from '../../types/portfolio';
export const PRODUCTION_URL='https://portfolio-woad-nu-owt4y7t889.vercel.app';
export function portfolioMetadata(data:PortfolioData):Metadata {
  const p=data.profile,title=`${p.name} — ${p.headline}`;
  return {
    metadataBase:new URL(PRODUCTION_URL),alternates:{canonical:PRODUCTION_URL},title,description:p.summary,
    keywords:[p.name,'Data Scientist','Data Analyst','Machine Learning Engineer','Computer Vision','Deep Learning','YOLO','Vision Transformers','Python','SQL','Power BI','Tableau','UET Peshawar','Portfolio'],
    authors:[{name:p.name}],creator:p.name,
    openGraph:{type:'website',locale:'en_US',url:PRODUCTION_URL,title,description:p.summary,siteName:`${p.name} Portfolio`,images:[{url:p.profileImage,width:600,height:600,alt:`${p.name} - Profile Photo`}]},
    twitter:{card:'summary_large_image',title,description:p.summary,images:[p.profileImage]},
    icons:{icon:'/favicon.ico'},robots:{index:process.env.VERCEL_ENV!=='preview',follow:process.env.VERCEL_ENV!=='preview'},
  };
}
