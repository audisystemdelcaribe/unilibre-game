import { facultiesActions } from './modules/faculties';
import { programsActions } from './modules/programs';
import { subjectsActions } from './modules/subjects';
import { seasonsActions } from './modules/seasons';
import { usersActions } from './modules/users';
import { gameLevelsActions } from './modules/game_levels.ts'
import { lifelinesActions } from './modules/lifelines';
import {gameModesActions} from './modules/game_modes';
import { questionsActions } from './modules/questions.ts'
import { fastestFingerActions } from './modules/fastest_finger';

export const server = {
    ...facultiesActions,
    ...programsActions,
    ...subjectsActions,
    ...seasonsActions,
    ...usersActions,
    ...gameLevelsActions,
    ...lifelinesActions,
    ...gameModesActions,
    ...questionsActions,
    ...fastestFingerActions,
};