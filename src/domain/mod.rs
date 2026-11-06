//! Modelos y repositorios. Cada módulo expone estructuras planas y funciones
//! que reciben la conexión; no hay ORM ni capas intermedias.

pub mod actions;
pub mod diary;
pub mod goals;
pub mod impulses;
pub mod metrics;
pub mod milestones;
pub mod notebooks;
pub mod plans;
pub mod prompts;
pub mod recurrence;
pub mod reminders;
pub mod reviews;
pub mod search;
pub mod tags;
pub mod tasks;

pub type Id = i64;

pub fn to_db_err(e: rusqlite::Error) -> crate::storage::DbError {
    crate::storage::DbError::Sql(e)
}
