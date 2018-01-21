import { DebugElement } from '@angular/core';
import { TestBed, ComponentFixture, async } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs/Subject';

import {
  FormDirective, ActionConstants, IFieldValidators
} from '../index';

import { TestComponent } from './util/test.component';
import { ITestAction, ITestFormShape, FORM_NAME } from './util/types';
import { setup, createRootState } from './util/setup';
import { StoreMock } from './mock/store-mock';

describe('Form directive [ngrxForm]', () => {
  let formDirective: FormDirective;
  let store: StoreMock;
  let fixture: ComponentFixture<TestComponent>;
  let debugElement: DebugElement;
  let actions$: Subject<ITestAction>;
  let dispatchSpy: jasmine.Spy;

  beforeEach(async(() => {
    actions$ = new Subject();
    setup(actions$);
  }));

  function setupTest() {
    fixture = TestBed.createComponent(TestComponent);
    debugElement = fixture.debugElement.query(By.directive(FormDirective));
    formDirective = debugElement.injector.get(FormDirective);
    store = debugElement.injector.get(Store) as any;
    dispatchSpy = spyOn(store, 'dispatch');
  }

  it('should create directive', () => {
    setupTest();
    expect(formDirective).toBeTruthy();
  });

  it('should fire DESTROY_FORM action on destroy', () => {
    setupTest();
    fixture.detectChanges();

    formDirective.ngOnDestroy();
    fixture.detectChanges();

    // 1 FORM_INIT action, 2 REGISTER_FIELD actions, 1 DESTROY_FORM action
    expect(dispatchSpy).toHaveBeenCalledTimes(4);

    const destroyAction: ITestAction = {
      type: ActionConstants.DESTROY_FORM,
      payload: { formName: FORM_NAME }
    }
    expect(dispatchSpy.calls.argsFor(3)).toEqual([destroyAction]);
  });

  it('emits form values on form submit', () => {
    setupTest();
    fixture.detectChanges();

    store.subject$.next(createRootState({
      fields: {
        name: { value: 'John' },
        age: { value: '40' },
      }
    }));

    const submitSpy = jasmine.createSpy('onSubmit');
    formDirective.submit.subscribe(submitSpy);
    debugElement.triggerEventHandler('submit', new Event('submit'));
    fixture.detectChanges();

    // 1 FORM_INIT action
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith({
      name: 'John',
      age: '40'
    });
  });

  describe('Angular initialisation (lifecycle)', () => {
    it('should fire INIT_FORM action on init', () => {
      setupTest();
      fixture.detectChanges();

      // 1 FORM_INIT action, 2 REGISTER_FIELD actions
      expect(dispatchSpy).toHaveBeenCalledTimes(3);

      const initAction: ITestAction = {
        type: ActionConstants.INIT_FORM,
        payload: { formName: FORM_NAME }
      }
      expect(dispatchSpy.calls.argsFor(0)).toEqual([initAction]);
    });

    it('should fire SET_INITIAL_VALUES if initial values are supplied', () => {
      setupTest();
      const initialValues = {
        name: 'Jen',
        age: '30'
      }
      formDirective.initialValues = initialValues;
      fixture.detectChanges();

      // 1 FORM_INIT action, 2 REGISTER_FIELD actions, 1 INITIAL_VALUES action
      expect(dispatchSpy).toHaveBeenCalledTimes(4);

      const setInitialAction: ITestAction = {
        type: ActionConstants.SET_INITIAL_VALUES,
        payload: {
          formName: FORM_NAME,
          values: initialValues
        }
      }
      expect(dispatchSpy.calls.argsFor(3)).toEqual([setInitialAction]);
    });

    it('should call updateFieldErrors after INIT_FORM action', () => {
      setupTest();
      fixture.detectChanges();
      const updateSpy = spyOn(formDirective, 'updateFieldErrors');

      const formState = {
        fields: {
          name: { value: '' },
          age: { value: '40' },
        }
      };

      const initAction: ITestAction = {
        type: ActionConstants.INIT_FORM,
        payload: { formName: FORM_NAME }
      }

      // Simluate state after all form initialising actions
      formDirective.formState = formState as any;
      // Simulate INIT_FORM action
      actions$.next(initAction);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy.calls.allArgs()).toEqual([
        [formState]
      ]);
    });

    it('should call updateFieldErrors after CHANGE_FIELD action', () => {
      setupTest();
      fixture.detectChanges();
      const updateSpy = spyOn(formDirective, 'updateFieldErrors');

      const changeAction: ITestAction = {
        type: ActionConstants.CHANGE_FIELD,
        payload: { formName: FORM_NAME, fieldName: 'name', value: 'Bob' }
      }

      const formState = {
        fields: {
          name: { value: 'Bob' },
          age: { value: '' },
        }
      }

      // Simluate state after all form initialising actions
      formDirective.formState = formState as any;
      // Simulate INIT_FORM action
      actions$.next(changeAction);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy.calls.allArgs()).toEqual([
        [formState]
      ]);
    });
  });

  describe('updateFieldErrors()', () => {
    /**
     * Helper function to test the updateFieldErrors() method, given the new
     * form state and validators
     * @param fieldValidators
     */
    function testUpdateFieldErrors(
      newFormState: any,
      fieldValidators: IFieldValidators<ITestFormShape>
    ) {
      setupTest();
      fixture.detectChanges();

      formDirective.fieldValidators = fieldValidators;
      formDirective.updateFieldErrors(newFormState as any);
      fixture.detectChanges();
    }

    it('does nothing when no validators are present', () => {
      const newFormState = {
        fields: {
          name: { value: 'Bob' },
          age: { value: '' },
        }
      };
      const fieldValidators: IFieldValidators<ITestFormShape> = {
        name: [],
        age: [],
      };

      testUpdateFieldErrors(newFormState, fieldValidators);

      const dispatchedActionTypes = dispatchSpy.calls.allArgs().map(a => a[0].type);

      // 1 FORM_INIT action, 2 REGISTER_FIELD actions
      expect(dispatchSpy).toHaveBeenCalledTimes(3);
      expect(dispatchedActionTypes).not.toContain(ActionConstants.UPDATE_FIELD_ERRORS);
    });

    it('does does nothing when field errors have not changed', () => {
      const newFormState = {
        fields: {
          name: { value: '' },
          age: { value: '' },
        }
      };
      const fieldValidators: IFieldValidators<ITestFormShape> = {
        name: [value => value ? '' : 'No name defined'],
        age: [],
      };

      testUpdateFieldErrors(newFormState, fieldValidators);

      const updateFieldErrorsAction: ITestAction = {
        type: ActionConstants.UPDATE_FIELD_ERRORS,
        payload: {
          formName: FORM_NAME,
          errors: {
            name: 'No name defined'
          }
        }
      };

      // 1 FORM_INIT action, 2 REGISTER_FIELD actions
      expect(dispatchSpy).toHaveBeenCalledTimes(4);
      expect(dispatchSpy.calls.argsFor(3)).toEqual([updateFieldErrorsAction])
    });

    it('fires an UPDATE_FIELD_ERRORS action when an field transitions TO an error state', () => {

    });

    it('fires an UPDATE_FIELD_ERRORS action when an field transitions AWAY an error state', () => {

    });
  });
});
