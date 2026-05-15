import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Sections } from './sections';

describe('Sections', () => {
  let component: Sections;
  let fixture: ComponentFixture<Sections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sections],
    }).compileComponents();

    fixture = TestBed.createComponent(Sections);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
