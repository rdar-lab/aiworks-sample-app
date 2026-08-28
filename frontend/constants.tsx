
import React from 'react';
import { 
  Rocket, ShieldAlert, CircleDollarSign, TrendingUp, Layers, Factory, 
  Cpu, Gavel, Search, Sun, Users, UserPlus, Zap, Building2, Settings,
  GraduationCap, Atom, Swords, Globe, Stethoscope, Scale, Brain
} from 'lucide-react';

/**
 * Returns a light-mode-safe Tailwind text color class.
 * Very light shades like `text-slate-100` are invisible on white backgrounds.
 * In light mode those are replaced with the -600 equivalent so the icon stays visible.
 */
export const lightSafeIconColor = (colorClass: string, lightMode: boolean): string => {
  if (!lightMode) return colorClass;
  // Replace -50, -100, -200 (near-white) with -600 (dark, readable on white)
  return colorClass.replace(/-(50|100|200)$/, '-600');
};

export const getIcon = (name: string, className?: string, size: number = 24) => {
  const props = { className, size };
  switch (name) {
    case "Rocket": return <Rocket {...props} />;
    case "ShieldAlert": return <ShieldAlert {...props} />;
    case "CircleDollarSign": return <CircleDollarSign {...props} />;
    case "TrendingUp": return <TrendingUp {...props} />;
    case "Layers": return <Layers {...props} />;
    case "Factory": return <Factory {...props} />;
    case "Cpu": return <Cpu {...props} />;
    case "Gavel": return <Gavel {...props} />;
    case "Search": return <Search {...props} />;
    case "Sun": return <Sun {...props} />;
    case "Users": return <Users {...props} />;
    case "UserPlus": return <UserPlus {...props} />;
    case "Zap": return <Zap {...props} />;
    case "Building2": return <Building2 {...props} />;
    case "Settings": return <Settings {...props} />;
    case "GraduationCap": return <GraduationCap {...props} />;
    case "Atom": return <Atom {...props} />;
    case "Swords": return <Swords {...props} />;
    case "Globe": return <Globe {...props} />;
    case "Stethoscope": return <Stethoscope {...props} />;
    case "Scale": return <Scale {...props} />;
    case "Brain": return <Brain {...props} />;
    default: return <Gavel {...props} />;
  }
};
