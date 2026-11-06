//! Catálogo declarativo de técnicas conductuales. Cada técnica conserva su
//! procedencia científica, su nivel de confianza y sus límites, que la interfaz
//! muestra tal cual (transparencia del nivel de evidencia, safety.md §5.8).
//! Los textos de los pasos de las vías del episodio de impulso viven aquí, no en
//! el código de pantalla.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Technique {
    pub clave: String,
    pub nombre: String,
    pub experimental: bool,
    pub confianza: String,
    pub finalidad: String,
    /// Explicación en lenguaje llano: qué es, cómo se usa aquí y qué se sabe.
    #[serde(default)]
    pub explicacion: String,
    #[serde(default)]
    pub evidencia: Vec<String>,
    #[serde(default)]
    pub limites: String,
    #[serde(default)]
    pub pasos: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Catalog {
    pub version: u32,
    pub tecnicas: Vec<Technique>,
}

static BUILTIN: &str = include_str!("builtin.json");

impl Catalog {
    pub fn builtin() -> Catalog {
        serde_json::from_str(BUILTIN).expect("builtin.json válido")
    }

    pub fn get(&self, clave: &str) -> Option<&Technique> {
        self.tecnicas.iter().find(|t| t.clave == clave)
    }

    /// Pasos de una técnica; vacío si no los define.
    pub fn steps(&self, clave: &str) -> Vec<String> {
        self.get(clave).map(|t| t.pasos.clone()).unwrap_or_default()
    }
}

impl Technique {
    /// Tarjeta de ayuda: nombre, confianza, finalidad, evidencia y límites.
    pub fn card(&self) -> Vec<String> {
        let mut v = vec![
            format!("{}{}", self.nombre, if self.experimental { " (experimental)" } else { "" }),
            format!("Calidad de la evidencia: {}", self.confianza),
            String::new(),
            self.finalidad.clone(),
            String::new(),
        ];
        if !self.explicacion.is_empty() {
            v.push(self.explicacion.clone());
            v.push(String::new());
        }
        v.push("Estudios en los que se apoya:".to_string());
        for e in &self.evidencia {
            v.push(format!("· {e}"));
        }
        if !self.limites.is_empty() {
            v.push(String::new());
            v.push(format!("Límites: {}", self.limites));
        }
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_loads_and_has_required_techniques() {
        let c = Catalog::builtin();
        assert_eq!(c.version, 1);
        for k in ["pausa_stop", "surfear_impulso", "respiracion_lenta", "distraccion_concreta", "espera_activa", "respuesta_competidora", "pantalla_desliz", "plan_si_entonces", "cierre_del_dia", "revision_semanal"] {
            let t = c.get(k).unwrap_or_else(|| panic!("falta {k}"));
            assert!(!t.evidencia.is_empty(), "{k} sin evidencia");
            assert!(!t.explicacion.is_empty(), "{k} sin explicación llana");
            assert!(matches!(t.confianza.as_str(), "Alta" | "Media" | "Baja" | "Muy baja"));
        }
        assert_eq!(c.steps("pausa_stop").len(), 4);
        assert!(c.get("escritura_expresiva").unwrap().experimental);
        let card = c.get("surfear_impulso").unwrap().card();
        assert!(card.iter().any(|l| l.contains("Bowen & Marlatt")));
    }

    #[test]
    fn no_forbidden_wording_in_catalog() {
        let s = BUILTIN.to_lowercase();
        for bad in ["racha rota", "has fallado", "fracaso", "deberías", "¡"] {
            assert!(!s.contains(bad), "palabra prohibida en el catálogo: {bad}");
        }
    }
}
