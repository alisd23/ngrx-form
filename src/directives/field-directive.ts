import { Directive, Input, OnInit, OnDestroy, HostListener, Injector, ElementRef } from '@angular/core';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs/Subscription';

import { FormDirective } from './form-directive';
import { RadioFieldControl, CheckboxFieldControl, DefaultFieldControl } from './field-controls';
import { IFieldControl, IStoreState, IFormState } from '../types';
import { getFormActions, IFormActions } from '../actions';
import { delayAction } from '../utils/angular';

import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/pluck';

const typeToControl = {
  radio: RadioFieldControl,
  checkbox: CheckboxFieldControl,
  default: DefaultFieldControl
}

/**
 * [ngrxField] directive
 * Handles the actions/logic relating to a single field, i.e. registering, unregistering,
 * focus, blur. This directive should be applied to 'form elements' (input, select, etc.).
 * The following actions need delaying until after change detection cycle:
 * [initForm, registerForm, setInitialValues]
 */
@Directive({
  selector: `[ngrxField]`,
  providers: [RadioFieldControl, CheckboxFieldControl, DefaultFieldControl]
})
export class FieldDirective implements OnInit, OnDestroy {
  @Input('ngrxField') fieldName: string;
  @Input('name') name: string;
  @Input('type') type: string;
  // element value => stateValueTransformer => state value
  @Input('stateValueTransformer') stateValueTransformer: (elementValue: any, e: Event) => any;
  // state value => elementValueTransformer => element value
  @Input('elementValueTransformer') elementValueTransformer: (stateValue: any, element: HTMLInputElement) => any;

  private initialized = false;
  private fieldValue: any;
  private formActions: IFormActions<any, any>;
  private fieldControl: IFieldControl;
  private subscriptions: Subscription[] = [];

  private get formName() { return this.formDirective.formName; }

  constructor(
    // Angular DI will look up the heirarchy until the first FormDirective instance is found
    // which should be the parent form
    private formDirective: FormDirective,
    private store: Store<IStoreState>,
    private injector: Injector,
    private elementRef: ElementRef
  ) {}

  @HostListener('focus')
  public onFocus() {
    this.store.dispatch(
      this.formActions.focusField(this.fieldName)
    );
  }

  @HostListener('blur')
  public onBlur() {
    this.store.dispatch(
      this.formActions.blurField(this.fieldName)
    );
  }

  public onChange(newValue: any, e: Event) {
    if (newValue !== this.fieldValue) {
      this.store.dispatch(
        this.formActions.changeField(
          this.fieldName,
          this.stateValueTransformer ? this.stateValueTransformer(newValue, e) : newValue
        )
      );
    }
  }

  private onStateValueUpdate(value: any) {
    const newValue = this.elementValueTransformer
      ? this.elementValueTransformer(value, this.elementRef.nativeElement)
      : value;
    this.fieldValue = newValue;
    this.fieldControl.onValueUpdate(newValue);
  }

  public ngOnInit() {
    this.formActions = getFormActions()(this.formName);

    this.fieldControl = this.injector.get(
      typeToControl[this.type] || typeToControl.default
    );

    this.fieldControl.initialise(
      (value, e) => this.onChange(value, e)
    );

    // Actions in the initialisation (onInit, afterViewInit, ...) phase must be delayed
    // until after this has completed. See README.md for information.
    delayAction(() => this.store.dispatch(
      this.formActions.registerField(this.fieldName)
    ));

    // Try to reduce flashing of values by using initialValues to set input value as
    // as soon as possible - instead of waiting for state to initialise.
    const { initialValues } = this.formDirective;
    if (initialValues && initialValues[this.fieldName] !== undefined) {
      this.onStateValueUpdate(initialValues[this.fieldName]);
    }

    const storeSubscription = this.store
      .select('form', this.formName)
      .filter(Boolean)
      .pluck<IFormState<any>, any>('fields', this.fieldName, 'value')
      .subscribe((value) => this.onStateValueUpdate(value));

    this.subscriptions.push(storeSubscription);
    this.initialized = true;
  }

  public ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());

    if (this.initialized) {
      // Actions in the initialisation (onInit, afterViewInit, ...) phase must be delayed
      // until after this has completed. See README.md for information.
      delayAction(() => this.store.dispatch(
        this.formActions.unregisterField(this.fieldName)
      ));
    }
  }
}
