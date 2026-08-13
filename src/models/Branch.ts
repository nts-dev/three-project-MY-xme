import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';

class Branch extends Model {
    static table = 'branches';

    @field('branch_id') branchId: any;

    @text('name') name: any;
}

export default Branch;
