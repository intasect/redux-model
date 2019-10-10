import { createDraft, finishDraft, isDraft, isDraftable } from 'immer';
import { Effects, Reducers } from '../utils/types';
import { StateReturnRequiredError } from '../exceptions/StateReturnRequiredError';
import { onStoreCreated } from '../utils/createReduxStore';

export class BaseReducer<Data> {
  protected readonly initData: Data;

  protected cases: Effects<Data> = [];

  protected readonly instanceName: string;

  protected currentReducerData?: Data;

  constructor(init: Data, instanceName: string) {
    this.initData = init;
    this.instanceName = instanceName;

    // In dev mode, if user modify code in model file, New model instance will be created by HMR.
    // We should restore reducer data into this instance.
    // Otherwise, it's dangerous to use `xxxModel.data`
    onStoreCreated((store) => {
      this.currentReducerData = this.currentReducerData || store.getState()[this.getReducerName()];
    });
  }

  public clear() {
    this.cases = [];
  }

  public addCase(...config: Effects<Data>) {
    this.cases.push(...config);
  }

  public changeCase(when: Effects<Data>[number]['when'], effect: Effects<Data>[number]['effect']) {
    for (const item of this.cases) {
      if (item.when === when) {
        item.effect = effect;
        break;
      }
    }
  }

  public getReducerName() {
    return this.instanceName;
  }

  public getCurrentReducerData(): Data {
    return this.currentReducerData!;
  }

  public createData(): Reducers {
    return {
      [this.getReducerName()]: (state, action) => {
        if (state === undefined) {
          state = typeof this.initData === 'function' ? (this.initData as Function)() : this.initData;
        }

        for (const { when, effect } of this.cases) {
          if (when === action.type) {
            if (isDraftable(state)) {
              const draft = createDraft(state);
              const responseDraft = effect(draft, action);

              if (responseDraft === undefined) {
                state = finishDraft(draft);
              } else if (isDraft(responseDraft)) {
                state = finishDraft(responseDraft);
              } else {
                state = responseDraft;
              }
            } else {
              state = effect(state, action);

              if (state === undefined) {
                throw new StateReturnRequiredError(when);
              }
            }
          }
        }

        this.currentReducerData = state;

        return state;
      },
    };
  }
}
