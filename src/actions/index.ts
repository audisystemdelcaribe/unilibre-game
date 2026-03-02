import { facultiesActions } from './modules/faculties';
import { programsActions } from './modules/programs';
import { subjectsActions } from './modules/subjects';
import { seasonsActions } from './modules/seasons';
import { usersActions } from './modules/users';

export const server = {
    ...facultiesActions,
    ...programsActions,
    ...subjectsActions,
    ...seasonsActions,
    ...usersActions
};